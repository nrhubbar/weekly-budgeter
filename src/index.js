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

const expenseStatusMap = {
    "PAID": "Paid",
    "PLANNED": "Planned",
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
    const weekStart = new Date(today.setDate(today.getDate()-today.getDay()));
    
    let lastSunday = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    const weekEnd = new Date(lastSunday.setDate(lastSunday.getDate() + 7));

    state = {
        ...state,
        weekStart: weekStart,
        weekEnd: weekEnd,
    };
}

const renderView = (html) => {
    document.getElementById("app").innerHTML = html;
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
    
    const currentWeekExpenses = budgetDocument.data().expenses.map((expense, i) => { 
            return {
                ...expense,
                id: i,
            };
        }).filter((expense) => {
            const expenseDate = expense.date.toDate();
            const inRange = expenseDate >= state.weekStart && expenseDate < state.weekEnd
            
            return inRange;
    });

    const paidSum = currentWeekExpenses.filter((expense) => expense.status == "PAID")
        .map((expense) => expense.amount)
        .reduce((a, b) => a + b, 0);
    const plannedSum = currentWeekExpenses.map((expense) => expense.amount)
        .reduce((a, b) => a + b, 0);
    const remainingBudget = (budgetDocument.data().limit - paidSum) / 100;
    const plannedRemaining = (budgetDocument.data().limit - plannedSum) / 100;

    const budgetView = `
        <div id="header">
            <h1 id="title">Weekly Budgeter</h1>
        </div>

        <div id="remaining-budget-container">
            <h2 id="remaining-budget" class="${remainingBudget >= 0 ? "under-budget" : "over-budget"}">\$${remainingBudget}</h2>
        </div>

        <div id="budget-sums-container">
            <p id="paid-sum"> Paid Sum: \$${paidSum / 100}</p>
            <p id="planned-remaining" class="${plannedRemaining >= 0 ? "under-budget" : "over-budget"}">Planned Remaining: \$${plannedRemaining}</p>
            <p id="planned-sum"> Planned Sum: \$${plannedSum / 100} </p>
        </div>

        <div id="expenses-container">
            <table id="expenses-table">

                <thead id="expenses-header">
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th></th>
                </thead>
                <tbody id="expenses-body">
                    ${currentWeekExpenses.map((expense, i) => 
                        `<tr id="expense-row-${i}">
                            <td id="expense-name-${i}">${expense.name}</td>
                            <td id="expense-amount-${i}">\$${expense.amount / 100}</td>
                            <td id="expense-date-${i}">${expense.date.toDate().toDateString()}</td>
                            <td id="expense-status-${i}" class="expense-status">${expenseStatusMap[expense.status] || expense.status}</td>
                            <td id="expense-buttons-${i}">
                                <button id="delete-expense-${i}" class="delete-expense table-button">Delete</button>
                                <button id="edit-expense-${i}" class="edit-expense table-button">Edit</button>
                            </td>
                        </tr>`).reduce(liReducer, "") || `<tr id="no-expenses"><td colspan=4>No Expenses Found for Date Range</td></tr>`}
                        
                </tbody>
                <tfoot id="expenses-footer">
                    <td id="expenses-name-cell">
                        <input type="text" placeholder="New Expense Name" id="new-expense-name">
                    </td>
                    <td id="expenses-amount-cell">
                        <input type="number" placeholder="$420.69" step="0.01" min="0" id="new-expense-amount">
                    </td>
                    <td id="expenses-date-cell">
                        <input type="date" id="new-expense-date">
                    </td>
                    <td id="expenses-status-cell">
                        ${Object.keys(expenseStatusMap).map((status) => {
                            return `
                                <input type="radio" id="new-${status.toLowerCase()}-radio" name="new-expense-status" value="${status}" checked>
                                <label for="new-${status.toLowerCase()}-radio">${expenseStatusMap[status]}</label>
                            `
                        }).reduce(liReducer)}
                    </td>
                    <td id="expenses-submit-cell">
                        <button id="submit-new-expense">Submit</button>
                    </td>
                </tfoot>
            </table>
        </div>
        
        <div id="navigate-buttons">
            <button id="see-all-budgets">See All Budgets</button>
            <button id="manage-budget-access">Manage Budget Access</button>
        </div>

        <div id="sign-out-container">
            <button id="sign-out">Sign Out </button>
        </div>
    `;

    renderView(budgetView);

    document.getElementById("see-all-budgets").addEventListener("click", renderAllBudgets);
    document.getElementById("manage-budget-access").addEventListener("click", renderBudgetAccessManager);
    document.getElementById("sign-out").addEventListener("click", signOut);
    document.getElementById("submit-new-expense").addEventListener("click", submitNewExpense);

    currentWeekExpenses.forEach((expense, i) => {
        document.getElementById(`delete-expense-${i}`).addEventListener("click", () => {
            document.getElementById(`expense-buttons-${i}`).innerHTML = `
                <button id="submit-expense-delete-${i}" class="submit-delete table-button">Submit Delete</button>
                <button id="cancel-expense-delete-${i}" class="cancel-delete table-button">Cancel</button>
            `
            document.getElementById(`submit-expense-delete-${i}`).addEventListener("click", () => {
                const updatedExpenses = state.budgetData.expenses.filter((e, i) => i != expense.id);

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
        document.getElementById(`edit-expense-${i}`).addEventListener("click", () => {
            document.getElementById(`expense-row-${i}`).innerHTML = `
            <td id="expense-edit-name-${i}-cell">
                <input type="text" value="${expense.name}" id="edit-expense-name-${i}">
            </td>
            <td id="expense-edit-amount-${i}-cell">
                <input type="number" value="${expense.amount / 100}" step="0.01" min="0" id="edit-expense-amount-${i}">
            </td>
            <td id="expense-edit-date-cell-${i}">
                <input type="date" value="${expense.date.toDate().toISOString().split('T')[0]}" id="edit-expense-date-${i}">
            </td>
            <td id="expense-edit-status-cell-${i}">
                ${Object.keys(expenseStatusMap).map((status) => {
                    return `
                        <input type="radio" id="edit-${status.toLowerCase()}-radio-${i}" name="edit-expense-status-${i}" value="${status}" checked>
                        <label for="new-${status.toLowerCase()}-radio">${expenseStatusMap[status]}</label>
                    `
                }).reduce(liReducer)}
            </td>
            <td id="expenses-submit-cell">
                <button id="submit-expense-edit-${i}" class="submit-edit table-button">Submit</button>
                <button id="cancel-expense-edit-${i}" class="cancel-edit table-button">Cancel</button>
            </td>
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
    });
}

async function renderAllBudgets() {
    const allBudgetQuery = query(collection(db, "budgets"), where("emails", "array-contains", state.email));
    const budgets = await getDocs(allBudgetQuery);

    const allBudgetsView = `
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
                                Name: ${budgetData.name} Limit: \$${budgetData.limit}
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
                                Name: ${budgetData.name} Limit: \$${budgetData.limit / 100}
                                <button id="view-budget-${budgetData.id}" class="view-budget">View</button>
                            </li>
                        `;
                    }).reduce(liReducer, "")
                }
            </ul>
        </div>
    `;

    renderView(allBudgetsView);

    budgets.forEach((budget) => {
        document.getElementById(`view-budget-${budget.id}`).addEventListener("click", () => {
            state = {
                ...state,
                budgetId: budget.id,
                budgetData: budget.data(),
            };
            renderBudgetById(budget.id);
        });
    });
    budgets.docs.filter((budgetData) => budgetData.id != state.favoriteBudgetId)
        .forEach((budget) => {
            document.getElementById(`mark-favorite-${budget.id}`).addEventListener("click", async () => {
                await setDoc(doc(db, "users", state.userId), {favoriteBudget: budget.id});
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
        <div id="header">
            <h1 id="title">Weekly Budget</h1>
        </div>

        <div id="budget-access-manager-container">
            <h2>Manage Access</h2>
            <ul>
                ${filteredEmailList.map((email, i) => `<li> ${email} <button id="remove-${i}" class="remove-email">Remove</button>`).reduce(liReducer, "") || "No Emails"}
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
        });

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

        if (userDocument.data().favoriteBudget) {

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
        });

        state = {
            ...state,
            budgetId: favoriteBudgetId,
            favoriteBudgetId: favoriteBudgetId,
        };

        renderBudgetById(favoriteBudgetId);
    } else {
        await setDoc(userDocumentReference, {});
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
