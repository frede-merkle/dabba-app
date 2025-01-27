const SUPABASE_URL = 'supabase-url';
const SUPABASE_KEY = 'supabase-anon-key';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const setupButton = document.getElementById('setupButton');
const userNameInput = document.getElementById('userNameInput');
const setupPhase = document.getElementById('setup-phase');
const mainContent = document.getElementById('main-content');
const errorMessage = document.getElementById('errorMessage');
const usernameDisplay = document.getElementById('username-display');
const currentUserElement = document.getElementById('current-username');
const nameInput = document.getElementById('nameInput');
const submitButton = document.getElementById('submitButton');

let currentUserName = getCookie('userName') || "";
if (currentUserName) {
    setupPhase.style.display = 'none';
    mainContent.style.display = 'block';
    usernameDisplay.style.display = 'block';
    currentUserElement.textContent = currentUserName;

    populateNameSuggestions();
    fetchSickPeople();
}

function setup() {
    setupButton.addEventListener('click', () => {
        const userName = userNameInput.value.trim();

        if (userName) {
            currentUserName = userName;
            setCookie('userName', userName, 30);

            setupPhase.style.display = 'none';
            mainContent.style.display = 'block';
            usernameDisplay.style.display = 'block';
            currentUserElement.textContent = currentUserName;

            populateNameSuggestions();
            fetchSickPeople();
        } else {
            errorMessage.textContent = 'Please enter your name to continue.';
            errorMessage.style.display = 'block';        }
    });
}

async function fetchSickPeople() {
    const orders = await fetchOrders(true)

    clearSickTableContent();
    const tablePlaceholder = document.getElementById("table-placeholder");
    const table = document.getElementById("sick-table");
    const tbody = table.querySelector('tbody');
    tablePlaceholder.style.display = (orders.length === 0) ? 'block' : 'none';
    table.style.display = (orders.length === 0) ? 'none' : 'table';

    orders.forEach(order => {
        const row = tbody.insertRow();

        const nameCell = row.insertCell();
        nameCell.textContent = order.full_name;
        const orderCell = row.insertCell();
        orderCell.textContent = `${order.menu} ${getOrderIcon(order.menu)}`;

        const takenCell = row.insertCell();
        if (order.taken) {
            takenCell.textContent = `${order.taken_by}`;
            takenCell.className = "taken-cell"
        } else {
            const takeButton = document.createElement('button');
            const confirmationText = document.createElement('div');
            takeButton.textContent = "Take lunch";
            takeButton.onclick = takeLunch(order, currentUserName, takeButton, confirmationText);
            takenCell.appendChild(takeButton);
            takenCell.appendChild(confirmationText);
        }

        const removeCell = row.insertCell();
        const removeIcon = document.createElement('span');
        removeIcon.textContent = "❌";
        removeIcon.style.cursor = 'pointer';
        removeIcon.onclick = async () => {
            const { error } = await supabaseClient
                .from('orders')
                .update({ sick: false })
                .eq('name', order.dabba_name);

            if (error) {
                console.error('Error removing person from sick list:', error);
            } else {
                await fetchSickPeople();
                await populateNameSuggestions();
            }
        };
        removeCell.appendChild(removeIcon);
    });
}

submitButton.addEventListener('click', async () => {
    const nameSuggestions = document.getElementById('nameSuggestions');
    const possibleNames = Array.from(nameSuggestions.getElementsByTagName('option')).map(option => option.value);
    const name = nameInput.value.trim();
    if (name && possibleNames.includes(name)) {
        markAsSick(name).then(() => {
            populateNameSuggestions();
        })
        nameInput.value = '';
    }
});

setup();

async function markAsSick(name) {
    const {data, fetchError} = await supabaseClient
        .from('users')
        .select('dabba_name')
        .eq('name', name)
    if (fetchError) {
        console.error('Error getting dabba name:', fetchError);
        return;
    }

    const { updateError } = await supabaseClient
        .from('orders')
        .update({ sick: true })
        .eq('name', data[0].dabba_name);
    if (updateError) {
        console.error('Error marking person as sick:', updateError);
        return;
    }

    fetchSickPeople();
}

function takeLunch(order, takenBy, buttonElement, confirmationElement) {
    return async () => {
        if (confirmationElement.innerHTML === "") {
            buttonElement.innerText = "Are you sure?"
            confirmationElement.innerHTML = "This cannot be undone."
        } else {
            const { data, error } = await supabaseClient
                .from('orders')
                .select('taken_by')
                .eq('name', order.dabba_name)
                .single();

            if (error) {
                console.error('Error checking if menu has been taken:', error);
                return;
            }

            if (data.taken_by !== null) {
                confirmationElement.innerHTML = "Already taken! Refreshing..."
                setTimeout(async () => {
                    await fetchSickPeople();
                }, 2000);
            } else {
                const { updateError } = await supabaseClient
                    .from('orders')
                    .update({ taken: true, taken_by: takenBy })
                    .eq('name', order.dabba_name);

                if (updateError) {
                    console.error('Error marking lunch as taken:', updateError);
                } else {
                    await fetchSickPeople();
                }
            }
        }
    };
}

function clearSickTableContent() {
    const table = document.getElementById("sick-table");
    const tbody = table.querySelector('tbody');

    if (tbody) {
        tbody.innerHTML = '';
    }
}

async function fetchOrders(sick) {
    const {data: ordersData, ordersError} = await supabaseClient
        .from('orders')
        .select('name, menu, taken, taken_by')
        .eq("sick", sick);
    if (ordersError) {
        console.error('Error fetching names from orders:', ordersError);
        return [];
    }

    const {data: usersData, usersError} = await supabaseClient
        .from('users')
        .select('name, dabba_name')
        .not('dabba_name', 'is', null);
    if (ordersError) {
        console.error('Error fetching names from users:', usersError);
        return [];
    }

    return ordersData.map(order => {
        const user = usersData.find(user => user.dabba_name === order.name);
        return {
            ...order,
            full_name: user ? user.name : null,
            dabba_name: user ? user.dabba_name : null,
        };
    })
        .filter(order => order.full_name !== null && order.dabba_name !== null)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

async function populateNameSuggestions() {
    const orders = await fetchOrders(false);
    const datalist = document.getElementById('nameSuggestions');
    datalist.innerHTML = '';
    orders.forEach(order => {
        const option = document.createElement('option');
        option.value = order.full_name;
        datalist.appendChild(option);
    });
}

function getOrderIcon(order) {
    switch (order) {
        case "den vegetariske (grøn)":
            return "🟢";
        case "den veganske (rød) (%gluten %laktose)":
            return "🔴";
        case "den klassiske (orange)":
            return "🟠";
        case "den varierende (lilla)":
            return "🟣";
        case "protein salat":
            return "🥗";
        case "vegetar salat":
            return "🥗🌱";
        case "kød sandwich":
            return "🥪";
        case "vegetar sandwich":
            return "🥪🌱";
        case "håndmadder":
            return "🍞";
        default:
            return "❓";
    }
}

function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value}; ${expires}; path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

usernameDisplay.addEventListener('click', () => {
    setCookie('userName', '', -1);
    mainContent.style.display = 'none';
    setupPhase.style.display = 'block';
});