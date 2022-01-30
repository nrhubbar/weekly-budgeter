import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, collection, query, where } from "firebase/firestore";


const firebaseConfig = {
    apiKey: "AIzaSyACRkkiwVQr_wGN1x1enqnqfrcEfUtdugw",
    authDomain: "weekly-budgeter.firebaseapp.com",
    databaseURL: "https://weekly-budgeter-default-rtdb.firebaseio.com",
    projectId: "weekly-budgeter",
    storageBucket: "weekly-budgeter.appspot.com",
    messagingSenderId: "199823933355",
    appId: "1:199823933355:web:6bfb59099ce48e5c5b9cee"
};

const app = initializeApp(firebaseConfig);
const provider = new GoogleAuthProvider();
const auth = getAuth();
const db = getFirestore();

var state = {};
const liReducer = (a,b) => `${a}\n${b}`;

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

async function addExpense() {
    const addExpenseView = `
        <label for="expense-name">Name: </label>
        <input type="text" id="expense-name">

        <label for="expense-amount">Amount: </label>
        <input type="number" min="0" id="expense-amount">

        <div id="add-expense-buttons">
            <button id="submit-expense">Submit</button>
            <button id="cancel-expense">Cancel</button>
        </div>
    `;

    document.getElementById("add-expense-container").innerHTML = addExpenseView;

    document.getElementById("submit-expense").addEventListener("click", () => {
        const expense = {
            date: new Date(),
            name: document.getElementById("expense-name").value,
            amount: parseInt(document.getElementById("expense-amount").value),
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
    });

    document.getElementById("cancel-expense").addEventListener("click", () => {
        renderBudgetById(state.budgetId);
    });
};

async function renderBudgetById(budgetId) {
    const budgetDocument = await getDoc(doc(db, "budgets", budgetId));

    if (!budgetDocument.exists()) {
        renderErrorPage();
    }

    state = {
        ...state,
        budgetId: budgetDocument.id,
        budgetData: budgetDocument.data(),
    };
    
    const currentWeekExpenses = budgetDocument.data().expenses.filter((expense) => {
        const expenseDate = expense.date.toDate();
        const inRange = expenseDate >= state.weekStart && expenseDate < state.weekEnd
        console.log(`Week Start: ${state.weekStart} --- Week End: ${state.weekEnd} --- Expense State: ${expenseDate} --- In Range: ${inRange}`); 
        return inRange;
    });
    const remainingBudget = budgetDocument.data().limit - currentWeekExpenses.map((expense) => expense.amount)
        .reduce((a, b) => a + b, 0);

    const budgetView = `
        <div id="header>
            <h1 id="title">Weekly Budgeter</h1>
        </div>

        <div id="remaining-budget-container">
            <h2 id="remaining-budget" class="${remainingBudget >= 0 ? "under-budget" : "over-budget"}">\$${remainingBudget}</h2>
        </div>

        <div id="add-expense-container">
            <button id="add-expense">+ Add Expense</button>
        </div>

        <div id="expenses-container">
            <ul>
                ${currentWeekExpenses.map((expense) => `<li>Name: ${expense.name} Amount: \$${expense.amount} Date: ${expense.date.toDate().toDateString()}</li>`).reduce(liReducer, "No Data")}
            </ul>
        </div>
        
        <div id="navigate-buttons">
            <button id="see-all-budgets">See All Budgets</button>
            <button id="manage-budget-access">Manage Budget Access</button>
        </div>
    `;

    renderView(budgetView);

    
    document.getElementById("see-all-budgets").addEventListener("click", renderAllBudgets);
    document.getElementById("manage-budget-access").addEventListener("click", renderBudgetAccessManager);
    document.getElementById("add-expense").addEventListener("click", addExpense);
}

async function renderAllBudgets() {
    const allBudgetQuery = query(collection(db, "budgets"), where("emails", "array-contains", state.email));
    const budgets = await getDocs(allBudgetQuery);

    console.dir(budgets);

    const allBudgetsView = `
        <div id="header>
            <h1 id="title">Weekly Budgeter</h1>
        </div>

        <div id="all-budgets-conatiner">
            <ul>
                ${budgets.docs.map((budget) => { 
                        return {...budget.data(), id: budget.id}
                    }).map((budgetData) => {
                        return `<li id="budget-${budgetData.id}" class="budget-list-item"> Name: ${budgetData.name} Limit: \$${budgetData.limit} </li>`
                    }).reduce(liReducer)
                }
            </ul>
        </div>
    `;

    renderView(allBudgetsView);

    budgets.forEach((budget) => {
        document.getElementById(`budget-${budget.id}`).addEventListener("click", () => {
            state = {
                ...state,
                budgetId: budget.id,
                budgetData: budget.data(),
            };
            renderBudgetById(budget.id);
        });
    });
};

async function renderBudgetAccessManager() {

};

async function renderNewAccount() {
    const newAccountView = `
        <div id="header">
            <h1 id="title>Weekly Budget</h1>
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
    `;

    renderView(newAccountView);

    document.getElementById("create-new-budget").addEventListener("click", async function() {
        const newBudget = {
            name: document.getElementById("budget-name").value,
            limit: document.getElementById("budget-limit").value,
            emails: [document.getElementById("additional-email").value, state.email],
            expenses: [],
        };

        const budgetReference = await addDoc(collection(db, "budgets"), newBudget);
        
        const userReference = doc(db, "users", state.userId)
        setDoc(userReference, {
            favoriteBudget: budgetReference.id,
        });

        renderBudgetById(budgetReference.id);
    });
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
        signInWithPopup(auth, provider).then(async function(result) {
            // This gives you a Google Access Token. You can use it to access the Google API.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            // The signed-in user info.
            const user = result.user;
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
                    renderBudgetById(userDocument.data().favoriteBudget);
                } else {
                    renderNewAccount();
                }
            } else {
                console.log("User does NOT have an account, creating one.");
                await setDoc(userDocumentReference, {});
                renderNewAccount();
            }
          // ...
        }).catch((error) => {
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

initializeState();
renderLogin();
