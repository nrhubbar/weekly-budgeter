import { getAuth, signInWithPopup, GoogleAuthProvider, browserLocalPersistence } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, collection, query, where, enableIndexedDbPersistence } from "firebase/firestore";


const firebaseConfig = {
    apiKey: "AIzaSyACRkkiwVQr_wGN1x1enqnqfrcEfUtdugw",
    authDomain: "weekly-budgeter.firebaseapp.com",
    databaseURL: "https://weekly-budgeter-default-rtdb.firebaseio.com",
    projectId: "weekly-budgeter",
    storageBucket: "weekly-budgeter.appspot.com",
    messagingSenderId: "199823933355",
    appId: "1:199823933355:web:6bfb59099ce48e5c5b9cee"
};

const EXPENSES_STATUS_MAP = {
    "PAID": "Paid",
    "PLANNED": "Planned",
};

const VIEW_MODE = {
    CARDS: 'CARDS',
    TABLE: 'TABLE',
};

const THEME = {
    DESERT: 'DESERT',
    VERDANT: 'VERDANT',
};

if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('service worker registered'))
        .catch(err => console.log('service worker not registered', err));
}

const app = initializeApp(firebaseConfig);
const provider = new GoogleAuthProvider();
const auth = getAuth();
auth.setPersistence(browserLocalPersistence);
const db = getFirestore();
enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled
          // in one tab at a a time.
          // ...
          console.log("Multiple Table Open");
          renderErrorPage();
      } else if (err.code == 'unimplemented') {
          // The current browser does not support all of the
          // features required to enable persistence
          // ...
      }
  });

var state = {};
const liReducer = (a,b) => `${a}\n${b}`;

const signOut = () => {
    auth.signOut();
    renderLogin();
};

const initializeState = () => {
    let now = new Date();
    let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today.setDate(today.getDate()-today.getDay())); // Today's Date - Day of Week == Sunday (always)
    
    let lastSunday = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    const weekEnd = new Date(lastSunday.setDate(lastSunday.getDate() + 7));

    state = {
        ...state,
        weekStart: weekStart,
        weekEnd: weekEnd,
        weekModifier: 0,
        viewMode: VIEW_MODE.CARDS,
    };
}

const sanitizeStringForHTML = (input) => {
    return input.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const renderView = (html) => {
    document.getElementById("app").innerHTML = html;
}

const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === THEME.VERDANT) {
        root.setAttribute('data-theme', 'verdant');
    } else {
        root.setAttribute('data-theme', 'desert');
    }
}

const getThemeToggleHTML = () => {
    const currentTheme = state.theme || THEME.DESERT;
    return `
        <div id="theme-toggle-container">
            <button id="theme-toggle" class="theme-toggle-button" title="Toggle theme">
                ${currentTheme === THEME.DESERT ? '🌵' : '🌿'}
            </button>
        </div>
    `;
}

const attachThemeToggleListener = async () => {
    const toggleButton = document.getElementById("theme-toggle");
    if (toggleButton) {
        toggleButton.addEventListener("click", async () => {
            const newTheme = state.theme === THEME.DESERT ? THEME.VERDANT : THEME.DESERT;
            state = {
                ...state,
                theme: newTheme,
            };
            
            // Save to Firebase
            if (state.userId) {
                const userReference = doc(db, "users", state.userId);
                await setDoc(userReference, {
                    favoriteBudget: state.favoriteBudgetId,
                    theme: newTheme,
                }, { merge: true });
            }
            
            applyTheme(newTheme);
            // Update toggle icon
            toggleButton.textContent = newTheme === THEME.DESERT ? '🌵' : '🌿';
        });
    }
};

const renderLoadingPage = () => {
    const loadingView = `
        <div id="header">
            <h1 id="title">Weekly Budgeter</h1>
        </div>
        <div id="loading-container">
            <h2>Loading...</h2>
        </div>
    `;
    renderView(loadingView);
};

const renderErrorPage = () => {
    const errorView = `
        <h1>Somthing went wrong, you've been logged out.</h1>
    `
    renderView(errorView);
    auth.signOut();
}

const submitNewExpense = async () => {
    const dateArray = document.getElementById("new-expense-date").value.split('-');
    const expenseDate = dateArray.length == 3 ? new Date(dateArray[0], dateArray[1] - 1, dateArray[2]) : new Date();
    const expense = {
        date: expenseDate,
        name: document.getElementById("new-expense-name").value,
        amount: Math.floor(new Number(document.getElementById("new-expense-amount").value) * 100),
        status: Array.from(document.getElementsByName("new-expense-status")).find((radio) => radio.checked).value,
    };

    const budgetReference = doc(db, "budgets", state.budgetId);
    setDoc(budgetReference, {
        ...state.budgetData,
        expenses: [
            ...state.budgetData.expenses,
            expense,
        ]
    });

    renderBudgetById(state.budgetId);
};

const getExpenseCards = (expenses) => {
    if (!expenses || expenses.length === 0) {
        return `<div class="no-expenses">No Expenses Found for Date Range</div>`;
    }
    return expenses.sort((a, b) => a.date - b.date).map((expense, i) => 
        `<div class="expense-card" id="expense-card-${i}">
            <div class="expense-card-content">
                <div class="expense-name" id="expense-name-${i}">${sanitizeStringForHTML(expense.name)}</div>
                <div class="expense-amount" id="expense-amount-${i}">\$${expense.amount / 100}</div>
                <div class="expense-date" id="expense-date-${i}">${expense.date.toDate().toDateString()}</div>
                <div class="expense-status" id="expense-status-${i}">${EXPENSES_STATUS_MAP[expense.status] || expense.status}</div>
            </div>
            <div class="expense-card-actions" id="expense-buttons-${i}">
                <button id="edit-expense-${i}" class="edit-expense">Edit</button>
                <button id="delete-expense-${i}" class="delete-expense">Delete</button>
            </div>
        </div>`).reduce(liReducer, "");
}

const getExpenseTable = (expenses) => {
    if (!expenses || expenses.length === 0) {
        return `<div class="no-expenses">No Expenses Found for Date Range</div>`;
    }
    const sortedExpenses = expenses.sort((a, b) => a.date - b.date);
    return `
        <table class="expenses-table-view">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${sortedExpenses.map((expense) => 
                    `<tr>
                        <td>${sanitizeStringForHTML(expense.name)}</td>
                        <td>\$${expense.amount / 100}</td>
                        <td>${expense.date.toDate().toDateString()}</td>
                        <td>${EXPENSES_STATUS_MAP[expense.status] || expense.status}</td>
                    </tr>`
                ).reduce(liReducer, "")}
            </tbody>
        </table>
    `;
}

// @stateless
// @noUi
function getCurrentWeekExpenses(expenses, weekStartAndEnd) {
    return expenses.map((expense, i) => { 
        return {
            ...expense,
            id: i,
        };
        }).filter((expense) => {
            const expenseDate = expense.date.toDate();
            const inRange = expenseDate >= weekStartAndEnd.weekStart && expenseDate < weekStartAndEnd.weekEnd
            
            return inRange;
    });
}

// @stateless
// @noUi
function getWeekStartAndEndDates(weekStart, weekModifier) {

    let currentWeekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    const weekStartWithOffset = new Date(currentWeekStart.setDate(currentWeekStart.getDate() + (7 * weekModifier)));
    
    let beginningSunday = new Date(weekStartWithOffset.getFullYear(), weekStartWithOffset.getMonth(), weekStartWithOffset.getDate());
    const weekEnd = new Date(beginningSunday.setDate(beginningSunday.getDate() + 7));


    return {
        weekStart: weekStartWithOffset,
        weekEnd: weekEnd,
    };
}

// @stateless
// @noUi
function calculateBalances(weekExpenses, weeklyLimit) {
    const paidSum = weekExpenses.filter((expense) => expense.status == "PAID")
        .map((expense) => expense.amount)
        .reduce((a, b) => a + b, 0);
    const plannedSum = weekExpenses.map((expense) => expense.amount)
        .reduce((a, b) => a + b, 0);
    const remainingBudget = (weeklyLimit - paidSum);
    const plannedRemaining = (weeklyLimit - plannedSum);

    return {
        paidSum: paidSum,
        plannedSum: plannedSum,
        remainingBudget: remainingBudget,
        plannedRemaining: plannedRemaining,
    };
}

async function renderBudgetById(budgetId=state.budgetId) {
    const budgetDocument = await getDoc(doc(db, "budgets", budgetId));

    if (!budgetDocument.exists()) {
        renderErrorPage();
    }

    state = {
        ...state,
        budgetId: budgetDocument.id,
        budgetData: budgetDocument.data(),
    };

    const weekStartAndEnd = getWeekStartAndEndDates(state.weekStart, state.weekModifier);
    const currentWeekExpenses = getCurrentWeekExpenses(budgetDocument.data().expenses, weekStartAndEnd);
    const balances = calculateBalances(currentWeekExpenses, budgetDocument.data().limit);
    
    // Ensure viewMode is set
    if (!state.viewMode) {
        state.viewMode = VIEW_MODE.CARDS;
    }

    const paidSum = balances.paidSum;
    const plannedSum = balances.plannedSum;
    const remainingBudget = balances.remainingBudget;
    const plannedRemaining = balances.plannedRemaining;

    const budgetView = `
        ${getThemeToggleHTML()}
        <div id="header">
            <h1 id="title">Weekly Budgeter</h1>
            <h2 id="budget-name">${sanitizeStringForHTML(state.budgetData.name)}</h2>
        </div>

        <div id="remaining-budget-container">
            <h2 id="remaining-budget" class="${remainingBudget >= 0 ? "under-budget" : "over-budget"}">\$${remainingBudget / 100}</h2>
        </div>

        <div id="budget-sums-container">
            <p id="paid-sum"> Paid Sum: \$${paidSum / 100}</p>
            <p id="planned-remaining" class="${plannedRemaining >= 0 ? "under-budget" : "over-budget"}">Planned Remaining: \$${plannedRemaining / 100}</p>
            <p id="planned-sum"> Planned Sum: \$${plannedSum / 100} </p>
        </div>

        <div id="expenses-container">
            <div id="expenses-navigation-container">
                <button id="previous-week"> Previous Week </button>
                <button id="next-week"> Next Week </button>
                <button id="toggle-view" class="toggle-view-button">${state.viewMode === VIEW_MODE.CARDS ? '📊 Table View' : '🃏 Card View'}</button>
            </div>
            ${state.viewMode === VIEW_MODE.CARDS ? `
                <div id="expenses-list">
                    <div id="new-expense-form" class="expense-card new-expense-card">
                        <div class="expense-card-content">
                            <input type="text" placeholder="New Expense Name" id="new-expense-name" class="expense-input">
                            <input type="number" placeholder="Amount" step="0.01" min="0" id="new-expense-amount" class="expense-input">
                            <input type="date" id="new-expense-date" class="expense-input">
                            <div class="expense-status-radio">
                                ${Object.keys(EXPENSES_STATUS_MAP).map((status) => {
                                    return `
                                        <label>
                                            <input type="radio" id="new-${status.toLowerCase()}-radio" name="new-expense-status" value="${status}" ${status === "PAID" ? "checked" : ""}>
                                            ${EXPENSES_STATUS_MAP[status]}
                                        </label>
                                    `
                                }).reduce(liReducer)}
                            </div>
                        </div>
                        <div class="expense-card-actions">
                            <button id="submit-new-expense">Submit</button>
                        </div>
                    </div>
                    ${getExpenseCards(currentWeekExpenses)}
                </div>
            ` : `
                <div id="expenses-table-container">
                    ${getExpenseTable(currentWeekExpenses)}
                </div>
            `}
        </div>
        
        <div id="navigate-buttons">
            <button id="see-all-budgets">See All Budgets</button>
            <button id="manage-budget-access">Manage Budget Access</button>
            <button id="carry-balance">Carry Balance</button>
        </div>

        <div id="sign-out-container">
            <button id="sign-out">Sign Out </button>
        </div>
    `;

    renderView(budgetView);
    
    // Apply theme
    applyTheme(state.theme || THEME.DESERT);
    attachThemeToggleListener();

    document.getElementById("see-all-budgets").addEventListener("click", renderAllBudgets);
    document.getElementById("manage-budget-access").addEventListener("click", renderBudgetAccessManager);
    document.getElementById("sign-out").addEventListener("click", signOut);
    
    // Only attach submit-new-expense listener if in card view
    if (state.viewMode === VIEW_MODE.CARDS) {
        const submitButton = document.getElementById("submit-new-expense");
        if (submitButton) {
            submitButton.addEventListener("click", submitNewExpense);
        }
    }
    
    document.getElementById("carry-balance").addEventListener("click", () => {
        // Step 1: Calculate Remaining Balance from Previous Week
        const lastWeekStartAndEnd = getWeekStartAndEndDates(state.weekStart, state.weekModifier - 1);
        const currentWeekExpenses = getCurrentWeekExpenses(budgetDocument.data().expenses, lastWeekStartAndEnd);
        const balances = calculateBalances(currentWeekExpenses, budgetDocument.data().limit);
        // Step 1.1: Use the negation to carry over. (If we go over budget on week 1, that should count as an expense in week 2) 
        const lastWeeksBalanceToCarry = -balances.remainingBudget;

        // Step 2: Add it as Expense to Current Week
        const expense = {
            date: weekStartAndEnd.weekStart, // Sunday of current week
            name: "Last Week's Balance",
            amount: lastWeeksBalanceToCarry,
            status: "PAID",
        };
    
        const budgetReference = doc(db, "budgets", state.budgetId);
        setDoc(budgetReference, {
            ...state.budgetData,
            expenses: [
                ...state.budgetData.expenses,
                expense,
            ]
        });
        // Step 3: Refresh
        renderBudgetById(state.budgetId);

    });

    document.getElementById("previous-week").addEventListener("click", () => {
        state = {
            ...state,
            weekModifier: state.weekModifier - 1,
        };
        
        renderBudgetById(state.budgetId);
    });

    document.getElementById("next-week").addEventListener("click", () => {
        state = {
            ...state,
            weekModifier: state.weekModifier + 1,
        };
        
        renderBudgetById(state.budgetId);
    });

    document.getElementById("toggle-view").addEventListener("click", () => {
        state = {
            ...state,
            viewMode: state.viewMode === VIEW_MODE.CARDS ? VIEW_MODE.TABLE : VIEW_MODE.CARDS,
        };
        
        renderBudgetById(state.budgetId);
    });

    if (state.viewMode === VIEW_MODE.CARDS) {
        currentWeekExpenses.forEach((expense, i) => {
            const deleteButton = document.getElementById(`delete-expense-${i}`);
            const editButton = document.getElementById(`edit-expense-${i}`);
            
            if (deleteButton) {
                deleteButton.addEventListener("click", () => {
                    const card = document.getElementById(`expense-card-${i}`);
                    card.classList.add("delete-mode");
                    document.getElementById(`expense-buttons-${i}`).innerHTML = `
                        <button id="submit-expense-delete-${i}" class="submit-delete">Submit Delete</button>
                        <button id="cancel-expense-delete-${i}" class="cancel-delete">Cancel</button>
                    `
                    document.getElementById(`submit-expense-delete-${i}`).addEventListener("click", () => {
                        const updatedExpenses = state.budgetData.expenses.filter((e, idx) => idx != expense.id);

                        const budgetReference = doc(db, "budgets", state.budgetId);
                        setDoc(budgetReference, {
                            ...state.budgetData,
                            expenses: updatedExpenses,
                        });

                        renderBudgetById(state.budgetId);
                    });

                    document.getElementById(`cancel-expense-delete-${i}`).addEventListener("click", () => {
                        renderBudgetById(state.budgetId);
                    });
                });
            }
            
            if (editButton) {
                editButton.addEventListener("click", () => {
                    const card = document.getElementById(`expense-card-${i}`);
                    card.classList.add("edit-mode");
                    card.innerHTML = `
                    <div class="expense-card-content">
                        <input type="text" value="${sanitizeStringForHTML(expense.name)}" id="edit-expense-name-${i}" class="expense-input">
                        <input type="number" value="${expense.amount / 100}" step="0.01" min="0" id="edit-expense-amount-${i}" class="expense-input">
                        <input type="date" value="${expense.date.toDate().toISOString().split('T')[0]}" id="edit-expense-date-${i}" class="expense-input">
                        <div class="expense-status-radio">
                            ${Object.keys(EXPENSES_STATUS_MAP).map((status) => {
                                return `
                                    <label>
                                        <input type="radio" id="edit-${status.toLowerCase()}-radio-${i}" name="edit-expense-status-${i}" value="${status}" ${expense.status === status ? "checked" : ""}>
                                        ${EXPENSES_STATUS_MAP[status]}
                                    </label>
                                `
                            }).reduce(liReducer)}
                        </div>
                    </div>
                    <div class="expense-card-actions">
                        <button id="submit-expense-edit-${i}" class="submit-edit">Submit</button>
                        <button id="cancel-expense-edit-${i}" class="cancel-edit">Cancel</button>
                    </div>
                    `
                    document.getElementById(`submit-expense-edit-${i}`).addEventListener("click", () => {
                        const dateArray = document.getElementById(`edit-expense-date-${i}`).value.split('-');
                        const expenseDate = dateArray.length == 3 ? new Date(dateArray[0], dateArray[1] - 1, dateArray[2]) : new Date();

                        let updatedExpenses = [...state.budgetData.expenses];
                        updatedExpenses[expense.id] = {
                            date: expenseDate,
                            name: document.getElementById(`edit-expense-name-${i}`).value,
                            amount: Math.floor(new Number(document.getElementById(`edit-expense-amount-${i}`).value) * 100),
                            status: Array.from(document.getElementsByName(`edit-expense-status-${i}`)).find((radio) => radio.checked).value,
                        }

                        const budgetReference = doc(db, "budgets", state.budgetId);
                        setDoc(budgetReference, {
                            ...state.budgetData,
                            expenses: updatedExpenses,
                        });

                        renderBudgetById(state.budgetId);
                    });

                    document.getElementById(`cancel-expense-edit-${i}`).addEventListener("click", () => {
                        renderBudgetById(state.budgetId);
                    });
                });
            }
        });
    }
}

async function renderAllBudgets() {
    const allBudgetQuery = query(collection(db, "budgets"), where("emails", "array-contains", state.email));
    const budgets = await getDocs(allBudgetQuery);

    const allBudgetsView = `
        ${getThemeToggleHTML()}
        <div id="header">
            <h1 id="title">Weekly Budgeter</h1>
        </div>

        <div id="all-budgets-conatiner">
            <ul>
                ${budgets.docs.map((budget) => { 
                        return {...budget.data(), id: budget.id}
                    }).filter((budgetData) => budgetData.id != state.favoriteBudgetId)
                    .map((budgetData) => {
                        return `
                            <li class="budget-list-item">
                                Name: ${sanitizeStringForHTML(budgetData.name)} Limit: \$${budgetData.limit / 100}
                                <button id="view-budget-${budgetData.id}" class="view-budget">View</button>
                                <button id="mark-favorite-${budgetData.id}" class="mark-favorite">Mark Favorite</button>
                            </li>
                        `;
                    }).reduce(liReducer, "")
                }
                ${budgets.docs.map((budget) => { 
                        return {...budget.data(), id: budget.id}
                    }).filter((budgetData) => budgetData.id == state.favoriteBudgetId)
                    .map((budgetData) => {
                        return `
                            <li class="budget-list-item favorite-budget">
                                Name: ${sanitizeStringForHTML(budgetData.name)} Limit: \$${budgetData.limit / 100}
                                <button id="view-budget-${budgetData.id}" class="view-budget">View</button>
                            </li>
                        `;
                    }).reduce(liReducer, "")
                }
            </ul>
        </div>
    `;

    renderView(allBudgetsView);
    applyTheme(state.theme || THEME.DESERT);
    attachThemeToggleListener();

    budgets.forEach((budget) => {
        document.getElementById(`view-budget-${budget.id}`).addEventListener("click", () => {
            state = {
                ...state,
                budgetId: budget.id,
                budgetData: budget.data(),
                weekModifier: 0,
            };
            renderBudgetById(budget.id);
        });
    });
    budgets.docs.filter((budgetData) => budgetData.id != state.favoriteBudgetId)
        .forEach((budget) => {
            document.getElementById(`mark-favorite-${budget.id}`).addEventListener("click", async () => {
                await setDoc(doc(db, "users", state.userId), {
                    favoriteBudget: budget.id,
                    theme: state.theme || THEME.DESERT,
                }, { merge: true });
                state = {
                    ...state,
                    favoriteBudgetId: budget.id,
                };
                renderAllBudgets();
            });
        });
};

async function renderBudgetAccessManager() {
    const filteredEmailList = state.budgetData.emails.filter((email) => email != state.email);
    const budgetAccessManagerView = `
        ${getThemeToggleHTML()}
        <div id="header">
            <h1 id="title">Weekly Budget</h1>
        </div>

        <div id="budget-access-manager-container">
            <h2>Manage Access</h2>
            <ul>
                ${filteredEmailList.map((email, i) => `<li> ${sanitizeStringForHTML(email)} <button id="remove-${i}" class="remove-email">Remove</button>`).reduce(liReducer, "") || "No Emails"}
            </ul>

            <div id="add-email-container">
                <label for="add-email">Email: </label>
                <input type="email" id="add-email">

                <button id="submit-email"> Add Email </button>
            </div>

            <button id="done-budget-access-manager">Done</button>
        </div>
    `;

    renderView(budgetAccessManagerView);
    applyTheme(state.theme || THEME.DESERT);
    attachThemeToggleListener();

    filteredEmailList.forEach((buttonEmail, i) => {
        document.getElementById(`remove-${i}`).addEventListener("click", async () => {
            const budgetReference = doc(db, "budgets", state.budgetId);
            const updatedEmails = state.budgetData.emails.filter((email) => email != buttonEmail);
            await setDoc(budgetReference, {
                ...state.budgetData,
                emails: updatedEmails,
            });

            state = {
                ...state,
                budgetData: {
                    ...state.budgetData,
                    emails: updatedEmails,
                },
            };

            renderBudgetAccessManager();
        });
    });

    document.getElementById("submit-email").addEventListener("click", async () => {
        const budgetReference = doc(db, "budgets", state.budgetId);
        const updatedEmails = state.budgetData.emails.concat(document.getElementById("add-email").value);

        await setDoc(budgetReference, {
            ...state.budgetData,
            emails: updatedEmails,
        });

        state = {
            ...state,
            budgetData: {
                ...state.budgetData,
                emails: updatedEmails,
            },
        };

        renderBudgetAccessManager();
    });
    
    document.getElementById("done-budget-access-manager").addEventListener("click", () => {
        renderBudgetById();
    });
};

async function renderNewAccount() {
    const newAccountView = `
        ${getThemeToggleHTML()}
        <div id="header">
            <h1 id="title">Weekly Budget</h1>
        </div>
        <div id="new-account-container">
            <h2>No budgets found</h2>
            
            <div id="new-budget-input">
                <label for="budget-name">Budget Name:</label>
                <input type="text" id="budget-name">
                
                <label for="budget-limit">Weekly Limit:</label>
                <input type="number" id="budget-limit" min="0">

                <label for="additional-email">Budget Partner Email <i>(optional)</i>:</label>
                <input type="email" id="additional-email">
            </div>

            <div id="submit-new-budget">
                <button id="create-new-budget">Create New Budget</button>
            </div>

            <div id="sign-out-container">
                <button id="sign-out">Sign Out</button>
            </div>
    `;

    renderView(newAccountView);
    applyTheme(state.theme || THEME.DESERT);
    attachThemeToggleListener();

    document.getElementById("create-new-budget").addEventListener("click", async function() {
        const newBudget = {
            name: document.getElementById("budget-name").value,
            limit: Math.floor(new Number(document.getElementById("budget-limit").value) * 100),
            emails: [document.getElementById("additional-email").value, state.email],
            expenses: [],
        };

        const budgetReference = await addDoc(collection(db, "budgets"), newBudget);
        
        const userReference = doc(db, "users", state.userId)
        setDoc(userReference, {
            favoriteBudget: budgetReference.id,
            theme: state.theme || THEME.DESERT,
        }, { merge: true });

        state = {
            ...state,
            favoriteBudgetId: budgetReference.id,
        };

        renderBudgetById(budgetReference.id);
    });

    document.getElementById("sign-out").addEventListener("click", signOut);
};

const executeLogin = async (user) => {
    
    state = {
        ...state,
        "userId": user.uid,
        "email": user.email,
    };

    renderLoadingPage();
    
    const userDocumentReference = doc(db, "users", user.uid);
    const userDocument = await getDoc(userDocumentReference);

    if (userDocument.exists()) {
        console.log("User has an account.");
        
        // Load theme preference
        const userData = userDocument.data();
        const savedTheme = userData.theme || THEME.DESERT;
        state = {
            ...state,
            theme: savedTheme,
        };
        applyTheme(savedTheme);

        if (userData.favoriteBudget) {

            // Check Access to Favorite Budget
            const favoriteBudgetRefernce = doc(db, "budgets", userDocument.data().favoriteBudget);
            const favoriteBudget = await getDoc(favoriteBudgetRefernce);

            if (favoriteBudget.data().emails.includes(state.email)) {
                state = {
                    ...state,
                    budgetId: userDocument.data().favoriteBudget,
                    favoriteBudgetId: userDocument.data().favoriteBudget,
                };

                renderBudgetById(userDocument.data().favoriteBudget);
                return;
            }
        }
    }
    console.log("User does NOT have an account, creating one.");
    
    const newUserExistingBudgetsQuery = query(collection(db, "budgets"), where("emails", "array-contains", state.email));
    const existingBudgets = await getDocs(newUserExistingBudgetsQuery);
    
    if (existingBudgets.size > 0) {
        const favoriteBudgetId = existingBudgets.docs[0].id;
        await setDoc(userDocumentReference, {
            favoriteBudget: favoriteBudgetId,
            theme: THEME.DESERT, // Default theme
        });

        state = {
            ...state,
            budgetId: favoriteBudgetId,
            favoriteBudgetId: favoriteBudgetId,
        };

        renderBudgetById(favoriteBudgetId);
    } else {
        await setDoc(userDocumentReference, {
            theme: THEME.DESERT, // Default theme
        });
        renderNewAccount();
    }
  // ...
};

const renderLogin = () => {
    const loginView = `
        <div id="header">
            <h1 id="title">Weekly Budgeter</h1>
        </div>

        <div id="login-container">
            <button id="login"> Login </button>
        </div>
    `;

    renderView(loginView);

    document.getElementById("login").addEventListener("click", () => {
        signInWithPopup(auth, provider).then((result) => executeLogin(result.user)).catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          // The email of the user's account used.
          const email = error.email;
          // The AuthCredential type that was used.
          const credential = GoogleAuthProvider.credentialFromError(error);
          console.log(`Something went wrong: code: ${errorCode}, message: ${errorMessage}, email: ${email}`);
        });
    });
};

const startApp = () => {

    renderLoadingPage();

    auth.onAuthStateChanged((user) => {
        if (user) {
            executeLogin(user);
        } else {
            renderLogin();
        }
    });
};

initializeState();
startApp();
