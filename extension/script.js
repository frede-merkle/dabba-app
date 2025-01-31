const SUPABASE_URL = 'supabase-url';
const SUPABASE_KEY = 'supabase-anon-key';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const setupButton = document.getElementById('setupButton');
const setupPhase = document.getElementById('setup-phase');
const mainContent = document.getElementById('main-content');
const maintenanceContainer = document.getElementById('maintenance-container');
const maintenanceReason = document.getElementById('maintenance-reason');
const errorMessage = document.getElementById('errorMessage');
const usernameDisplay = document.getElementById('username-display');
const currentUserElement = document.getElementById('current-username');
const submitButton = document.getElementById('submitButton');
const tablePlaceholder = document.getElementById("table-placeholder");
const sickTable = document.getElementById("sick-table");
const userNameInput = document.getElementById('userNameInput');
const userNameSuggestionsList = document.getElementById('userNameSuggestions');
const markSickInput = document.getElementById('markSickInput');
const markSickSuggestionsList = document.getElementById('markSickSuggestions');

let currentUserName = getCookie('userName') || "";

init();

async function init() {
    const {data, error} = await supabaseClient
        .from('settings')
        .select('active, reason')
        .single()

    if (error || !data.active) {
        setupPhase.style.display = 'none';
        mainContent.style.display = 'none';
        maintenanceContainer.style.display = 'block';
        if (error) {
            maintenanceReason.innerText = error.message
        } else if (data.reason) {
            maintenanceReason.innerText = data.reason
        }
    } else if (currentUserName) {
        setupPhase.style.display = 'none';
        mainContent.style.display = 'block';
        usernameDisplay.style.display = 'block';
        currentUserElement.textContent = currentUserName;
        maintenanceContainer.style.display = 'none';

        populateMarkSickSuggestions();
        fetchSickPeople();
    } else {
        populateUserNameSuggestions();
        setupPhase.style.display = 'block';
        maintenanceContainer.style.display = 'none';
    }
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

async function fetchSickPeople() {
    const orders = await fetchOrders(true)

    const tbody = sickTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
    }
    tablePlaceholder.style.display = (orders.length === 0) ? 'block' : 'none';
    sickTable.style.display = (orders.length === 0) ? 'none' : 'table';

    orders.forEach(order => {
        const row = tbody.insertRow();

        const nameCell = row.insertCell();
        nameCell.textContent = `${order.full_name} (${order.company})`;
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
                await populateMarkSickSuggestions();
            }
        };
        removeCell.appendChild(removeIcon);
    });
}

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
        .update({ sick: true, marked_by: currentUserName })
        .eq('name', data[0].dabba_name);
    if (updateError) {
        console.error('Error marking person as sick:', updateError);
        return;
    }

    fetchSickPeople();
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
        .select('name, dabba_name, company')
        .not('dabba_name', 'is', null);
    if (ordersError) {
        console.error('Error fetching names and dabba_names from users:', usersError);
        return [];
    }

    return ordersData.map(order => {
        const user = usersData.find(user => user.dabba_name === order.name);
        return {
            ...order,
            full_name: user ? user.name : null,
            dabba_name: user ? user.dabba_name : null,
            company: user ? user.company : null,
        };
    })
        .filter(order => order.full_name !== null && order.dabba_name !== null && order.company !== null)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

async function fetchUsers() {
    const {data, errors} = await supabaseClient
        .from('users')
        .select('name, company')
    if (errors) {
        console.error('Error fetching names and companies from users:', errors);
        return [];
    }

    return data.map(user => {
        return `${user.name} (${user.company})`;
    })
}

async function populateUserNameSuggestions() {
    const users = await fetchUsers();
    userNameSuggestionsList.innerHTML = '';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        userNameSuggestionsList.appendChild(option);
    });
}

async function populateMarkSickSuggestions() {
    const orders = await fetchOrders(false);
    markSickSuggestionsList.innerHTML = '';
    orders.forEach(order => {
        const option = document.createElement('option');
        option.value = `${order.full_name} (${order.company})`
        markSickSuggestionsList.appendChild(option);
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

// Event listeners

setupButton.addEventListener('click', () => {
    const possibleUserNames = Array.from(userNameSuggestionsList.getElementsByTagName('option')).map(option => option.value);
    const userName = userNameInput.value.trim();
    if (userName && possibleUserNames.includes(userName)) {
        currentUserName = userName;
        setCookie('userName', userName, 30);

        setupPhase.style.display = 'none';
        mainContent.style.display = 'block';
        usernameDisplay.style.display = 'block';
        currentUserElement.textContent = currentUserName;

        populateMarkSickSuggestions();
        fetchSickPeople();
    } else {
        errorMessage.textContent = 'Please pick a name from the list.';
        errorMessage.style.display = 'block';        }
});

submitButton.addEventListener('click', async () => {
    const possibleNames = Array.from(markSickSuggestionsList.getElementsByTagName('option')).map(option => option.value);
    const nameAndCompany = markSickInput.value.trim();
    if (nameAndCompany && possibleNames.includes(nameAndCompany)) {
        const name = markSickInput.value.split("(")[0].trim();
        markAsSick(name).then(() => {
            populateMarkSickSuggestions();
        })
        markSickInput.value = '';
    }
});

usernameDisplay.addEventListener('click', () => {
    userNameInput.value = "";
    setCookie('userName', '', -1);
    mainContent.style.display = 'none';
    setupPhase.style.display = 'block';
    populateUserNameSuggestions();
});