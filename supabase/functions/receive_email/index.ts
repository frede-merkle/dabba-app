import {serve} from "https://deno.land/std@0.168.0/http/server.ts"
import {IncomingMail} from "https://esm.sh/cloudmailin"
import {createError, createResponse, initSupabase, validateEnvironment} from "./helpers.ts"

interface Order {
  name: string
  menu: string
  sick?: boolean
  taken?: boolean
}

validateEnvironment();
const supabase = initSupabase()

serve(async (req: Request): Promise<Response> => {
  try {
    const email: IncomingMail = await req.json()
    if (!email.attachments?.[0]?.content) {
      throw createError('NO_ATTACHMENT', 'No PDF attachment found in email')
    }

    const url = await getAttachmentURLFromMail(email)
    const pdfJSON: string = await postToApyHub(url)
    const orders: Order[] = parseJson(pdfJSON)
    await replaceOrdersTableInDatabase(orders)

    return createResponse({ message: "File processed successfully" }, 200)
  } catch (error) {
    console.error('Processing error:', error)
    return createResponse({ error: error.message }, 400)
  }
})

async function getAttachmentURLFromMail(email: IncomingMail) {
  const attachment = email.attachments?.[0]?.content
  if (!attachment) {
    throw createError('ATTACHMENT_ERROR', 'No attachment found in email')
  }

  try {
    const fileBuffer = new Uint8Array(
      atob(attachment).split("").map((c) => c.charCodeAt(0))
    )

    const fileName = `attachment-${Date.now()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from("dabba")
      .upload(fileName, fileBuffer, {
        contentType: "application/pdf",
      })

    if (uploadError) {
      throw uploadError
    }

    const data = supabase.storage
      .from("dabba")
      .getPublicUrl(fileName)
    return data?.data?.publicUrl
  } catch (error) {
    throw createError(
      'STORAGE_ERROR',
      `Failed to process attachment: ${error.message}`,
      error
    )
  }
}

async function postToApyHub(url: string) {
  try {
    const response = await fetch('https://api.apyhub.com/extract/text/pdf-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apy-token': Deno.env.get('APYHUB_TOKEN')!
      },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      throw new Error(`ApyHub API returned status ${response.status}`)
    }

    const pdfJSON = await response.json()
    if (pdfJSON.error) {
      throw createError('PDF_PROCESSING_ERROR', pdfJSON.error);
    }
    return pdfJSON.data
  } catch (error) {
    throw createError('APYHUB_ERROR', `Failed to process PDF: ${error.message}`)
  }
}

function parseJson(data: string): Order[] {
  if (!data) {
    throw createError('PARSE_ERROR', 'No data to parse')
  }
  const normalizedData = data.toLowerCase()

  // Find orders
  let orders = normalizedData
    .split("kuverter")
    .slice(2)
    .join('')
    .split("total")[0]
    .trim()
  if (!orders) {
    throw createError('PARSE_ERROR', 'No orders found in document')
  }

  // Find names and corresponding orders
  const menuTypes = [
    "den vegetariske \\(grøn\\)",
    "den veganske \\(rød\\) \\(%gluten %laktose\\)",
    "den klassiske \\(orange\\)",
    "den varierende \\(lilla\\)",
    "vegetar salat",
    "kød sandwich",
    "protein salat",
    "vegetar sandwich",
    "håndmadder"
  ]
  const possibleOrdersRegex = new RegExp(`(${menuTypes.join("|")})`, "g")
  const ordersWithoutAmount = orders.replaceAll("1x ", "")
  const namesAndMenus = ordersWithoutAmount
    .split(possibleOrdersRegex)
    .filter(e => e !== undefined && e !== "")
    .map(e => e.trim())

  // Structure names and orders
  const listOfMenus: Order[] = []
  for (let i = 0; i < namesAndMenus.length; i += 2) {
    const menu = namesAndMenus[i + 1]
    let name = namesAndMenus[i]
    if (!name || !menu) continue

    if (name.startsWith(",")) name = name.substring(2) // Some names start with ", "
    if (!listOfMenus.some(e => e.name === name)) {
      listOfMenus.push({name: name, menu: menu})
    }
  }

  if (listOfMenus.length === 0) {
    throw createError('PARSE_ERROR', 'No valid orders found after parsing')
  }
  return listOfMenus
}

async function replaceOrdersTableInDatabase(orders: Order[]) {
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .gte('name', '')

  if (deleteError) {
    throw createError('DATABASE_ERROR', 'Failed to clear table: ' + deleteError.message, deleteError)
  }

  const { error: upsertError } = await supabase
    .from('orders')
    .upsert(orders)
  if (upsertError) {
    throw createError('DATABASE_ERROR', upsertError.message, upsertError)
  }
}