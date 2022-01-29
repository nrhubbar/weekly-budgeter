import { getAuth, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { initializeApp } from "firebase/app";

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

document.addEventListener('DOMContentLoaded', function() {
    const loadEl = document.querySelector('#load');
    // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
    // // The Firebase SDK is initialized and available here!
    //
    // firebase.auth().onAuthStateChanged(user => { });
    // firebase.database().ref('/path/to/ref').on('value', snapshot => { });
    // firebase.firestore().doc('/foo/bar').get().then(() => { });
    // firebase.functions().httpsCallable('yourFunction')().then(() => { });
    // firebase.messaging().requestPermission().then(() => { });
    // firebase.storage().ref('/path/to/ref').getDownloadURL().then(() => { });
    // firebase.analytics(); // call to activate
    // firebase.analytics().logEvent('tutorial_completed');
    // firebase.performance(); // call to activate
    //
    // // 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

    try {
      let features = [
        'auth', 
        'database', 
        'firestore',
        'functions',
        'messaging', 
        'storage', 
        'analytics', 
        'remoteConfig',
        'performance',
      ].filter(feature => typeof app[feature] === 'function');
      loadEl.textContent = `Firebase SDK loaded with ${features.join(', ')}`;
    } catch (e) {
      console.error(e);
      loadEl.textContent = 'Error loading the Firebase SDK, check the console.';
    }
});

document.getElementById("login").addEventListener("click", () => {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithRedirect(auth, provider);
});
