import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {

    const firebaseConfig = {
    apiKey: "AIzaSyBGvE1hK3nmR2UYclhBTMRMRXEBy6S15I4",
    authDomain: "recipe-app-47ff5.firebaseapp.com",
    projectId: "recipe-app-47ff5",
    storageBucket: "recipe-app-47ff5.firebasestorage.app",
    messagingSenderId: "462719369059",
    appId: "1:462719369059:web:fc3a6d60dc4331849a9d56"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth();
    const db = getFirestore();
    const googleProvider = new GoogleAuthProvider();

    // DOM elements
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    const googleSignInBtn = document.getElementById("google-signin-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const authSection = document.getElementById("auth-section");
    const addRecipeSection = document.getElementById("add-recipe-section");

    // Sign up
    signupBtn.addEventListener("click", () => {
        const email = emailInput.value;
        const password = passwordInput.value;
      
        createUserWithEmailAndPassword(auth, email, password)
          .then(() => alert("Signup successful!"))
          .catch((err) => alert("Signup failed: " + err.message));
      });
      
  
  // Log in
  loginBtn.addEventListener("click", () => {
    const email = emailInput.value;
    const password = passwordInput.value;
  
    signInWithEmailAndPassword(auth, email, password)
      .then(() => alert("Login successful!"))
      .catch((err) => alert("Login failed: " + err.message));
  });

  // Google Sign-In
  googleSignInBtn.addEventListener("click", () => {
    signInWithPopup(auth, googleProvider)
      .then((result) => {
        const user = result.user;
        alert(`Welcome ${user.displayName}!`);
      })
      .catch((error) => {
        alert("Google sign-in failed: " + error.message);
      });
  });
  
  
  // Log out
  document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth)
      .then(() => alert("Logged out!"))
      .catch((err) => alert("Logout failed: " + err.message));
  });

    // Listen to auth state
    auth.onAuthStateChanged((user) => {
    if (user) {
        // User is logged in
        addRecipeSection.style.display = "block";
        viewToggle.style.display = "inline-block";
        logoutBtn.style.display = "inline-block";
        loginBtn.style.display = "none";
        signupBtn.style.display = "none";
        googleSignInBtn.style.display = "none";
        emailInput.style.display = "none";
        passwordInput.style.display = "none";
        
        // Reset to my recipes view and load user's recipes when they log in
        currentView = "my-recipes";
        updateViewToggleButton();
        loadRecipes();
    } else {
        // User is logged out - show shared recipes by default
        addRecipeSection.style.display = "none";
        viewToggle.style.display = "inline-block"; // Still show toggle for logged-out users
        logoutBtn.style.display = "none";
        loginBtn.style.display = "inline-block";
        signupBtn.style.display = "inline-block";
        googleSignInBtn.style.display = "inline-block";
        emailInput.style.display = "inline-block";
        passwordInput.style.display = "inline-block";
        
        // Clear search/filters and show shared recipes for logged-out users
        searchInput.value = "";
        categoryFilter.value = "";
        currentView = "shared-recipes"; // Default to shared recipes for logged-out users
        updateViewToggleButton();
        loadRecipes(); // Load shared recipes even when logged out
    }
    });

    const form = document.getElementById("recipe-form");
    const recipesContainer = document.getElementById("recipes");
    const searchInput = document.getElementById("search-input");
    const categoryFilter = document.getElementById("category-filter");
    const viewToggle = document.getElementById("view-toggle");
  
    // Store recipes globally
    let recipes = [];
    let filteredRecipes = [];
    let currentView = "my-recipes"; // "my-recipes" or "shared-recipes"

    // Toggle between My Recipes and Shared Recipes
    function toggleView() {
      const user = auth.currentUser;
      
      if (currentView === "my-recipes") {
        currentView = "shared-recipes";
      } else {
        // Only allow switching to "my-recipes" if user is logged in
        if (user) {
          currentView = "my-recipes";
        } else {
          alert("Please log in to view your personal recipes.");
          return;
        }
      }
      
      updateViewToggleButton();
      loadRecipes();
    }

    function updateViewToggleButton() {
      const user = auth.currentUser;
      
      if (currentView === "my-recipes") {
        viewToggle.textContent = "View Shared Recipes";
        viewToggle.className = "view-toggle-btn";
      } else {
        if (user) {
          viewToggle.textContent = "View My Recipes";
          viewToggle.className = "view-toggle-btn shared-view";
        } else {
            viewToggle.style.display = "none";
        }
      }
    }

    // Add event listener for view toggle
    viewToggle.addEventListener("click", toggleView);

    // Search and filter functions
    function filterRecipes() {
      const searchTerm = searchInput.value.toLowerCase().trim();
      const selectedCategory = categoryFilter.value;

      filteredRecipes = recipes.filter(recipe => {
        // Check if recipe matches search term (in title, ingredients, or instructions)
        const matchesSearch = !searchTerm || 
          recipe.title.toLowerCase().includes(searchTerm) ||
          recipe.ingredients.toLowerCase().includes(searchTerm) ||
          recipe.instructions.toLowerCase().includes(searchTerm);

        // Check if recipe matches selected category
        const matchesCategory = !selectedCategory || recipe.category === selectedCategory;

        return matchesSearch && matchesCategory;
      });

      renderRecipes();
    }

    // Add event listeners for search and filter
    searchInput.addEventListener("input", filterRecipes);
    categoryFilter.addEventListener("change", filterRecipes);
  
    // Load recipes from Firestore
    async function loadRecipes() {
      try {
        let q;
        if (currentView === "my-recipes") {
          // Load user's own recipes (requires login)
          const user = auth.currentUser;
          if (!user) {
            recipes = [];
            filteredRecipes = [];
            renderRecipes();
            return;
          }
          q = query(collection(db, "recipes"), where("userId", "==", user.uid));
        } else {
          // Load shared recipes (available to everyone, including logged-out users)
          q = query(collection(db, "recipes"), where("isPublic", "==", true));
        }

        const querySnapshot = await getDocs(q);
        
        recipes = [];
        querySnapshot.forEach((doc) => {
          recipes.push({
            id: doc.id,
            ...doc.data()
          });
        });

        // Sort recipes by creation date (newest first)
        recipes.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        // Apply current filters after loading
        filterRecipes();
      } catch (error) {
        console.error("Error loading recipes:", error);
        alert("Failed to load recipes: " + error.message);
      }
    }

    // Upload image to Firebase Storage
    async function uploadImage(file, recipeId) {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");

        // Create a unique filename
        const fileName = `${user.uid}/${recipeId}/${Date.now()}_${file.name}`;
        const storageRef = ref(getStorage(), `recipe-images/${fileName}`);
        
        // Upload file
        const snapshot = await uploadBytes(storageRef, file);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
      } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
      }
    }

    // Save recipe to Firestore
    async function saveRecipe(recipeData, imageFile = null) {
      try {
        const user = auth.currentUser;
        if (!user) {
          alert("You must be logged in to save recipes");
          return;
        }

        // First create the recipe document
        const docRef = await addDoc(collection(db, "recipes"), {
          ...recipeData,
          userId: user.uid,
          createdAt: new Date(),
          userEmail: user.email,
          userName: user.displayName || user.email.split('@')[0],
          isPublic: recipeData.isPublic || false,
          imageUrl: null // Will be updated if image is uploaded
        });

        // If there's an image, upload it and update the recipe
        if (imageFile) {
          try {
            const imageUrl = await uploadImage(imageFile, docRef.id);
            
            // Update the recipe with the image URL
            await updateDoc(doc(db, "recipes", docRef.id), {
              imageUrl: imageUrl
            });
            
            console.log("Recipe saved with image, ID: ", docRef.id);
          } catch (imageError) {
            console.error("Error uploading image:", imageError);
            alert("Recipe saved but image upload failed: " + imageError.message);
          }
        } else {
          console.log("Recipe saved without image, ID: ", docRef.id);
        }
        
        loadRecipes(); // Reload and reapply filters
      } catch (error) {
        console.error("Error saving recipe:", error);
        alert("Failed to save recipe: " + error.message);
      }
    }

    // Toggle recipe privacy (public/private)
    async function toggleRecipePrivacy(recipeId, currentPrivacy) {
      try {
        const recipeRef = doc(db, "recipes", recipeId);
        await updateDoc(recipeRef, {
          isPublic: !currentPrivacy
        });
        console.log("Recipe privacy updated");
        loadRecipes(); // Reload to show updated status
      } catch (error) {
        console.error("Error updating recipe privacy:", error);
        alert("Failed to update recipe privacy: " + error.message);
      }
    }

    // Delete recipe from Firestore
    async function deleteRecipe(recipeId) {
      try {
        await deleteDoc(doc(db, "recipes", recipeId));
        console.log("Recipe deleted");
        loadRecipes(); // Reload and reapply filters
      } catch (error) {
        console.error("Error deleting recipe:", error);
        alert("Failed to delete recipe: " + error.message);
      }
    }
  
    function renderRecipes() {
      recipesContainer.innerHTML = "";
      
      // Use filtered recipes for rendering
      const recipesToRender = filteredRecipes;
      const searchTerm = searchInput.value.toLowerCase().trim();
      const selectedCategory = categoryFilter.value;
      const user = auth.currentUser;
  
      if (recipesToRender.length === 0) {
        if (recipes.length === 0) {
          let message;
          if (currentView === "my-recipes") {
            message = "No recipes yet. Create your first recipe!";
          } else {
            message = user ? 
              "No shared recipes found. Be the first to share a recipe!" : 
              "No shared recipes found. Log in to create and share your own recipes!";
          }
          recipesContainer.innerHTML = `<p>${message}</p>`;
        } else {
          // Show message when no recipes match the current filters
          let message = "No recipes found";
          if (searchTerm && selectedCategory) {
            message += ` matching "${searchTerm}" in category "${selectedCategory}".`;
          } else if (searchTerm) {
            message += ` matching "${searchTerm}".`;
          } else if (selectedCategory) {
            message += ` in category "${selectedCategory}".`;
          }
          recipesContainer.innerHTML = `<p>${message}</p>`;
        }
        return;
      }

      // Add results count and view info
      const headerInfo = document.createElement("div");
      headerInfo.className = "recipes-header-info";
      
      if (currentView === "shared-recipes") {
        const communityText = user ? 
          "👥 Viewing shared recipes from the community" : 
          "👥 Viewing shared recipes from the community (Log in to create your own!)";
        headerInfo.innerHTML = `<p class="view-info"><em>${communityText}</em></p>`;
      }
      
      if (recipesToRender.length !== recipes.length) {
        const countInfo = document.createElement("p");
        countInfo.className = "search-results-info";
        countInfo.innerHTML = `<em>Showing ${recipesToRender.length} of ${recipes.length} recipes</em>`;
        headerInfo.appendChild(countInfo);
      }
      
      if (headerInfo.children.length > 0) {
        recipesContainer.appendChild(headerInfo);
      }
  
      recipesToRender.forEach((recipe) => {
        const card = document.createElement("div");
        card.className = "recipe-card";
        
        // Check if current user owns this recipe
        const isOwner = user && recipe.userId === user.uid;

        // Format the createdAt date
        let dateString = "Unknown date";
        if (recipe.createdAt) {
          const date = recipe.createdAt.toDate ? recipe.createdAt.toDate() : new Date(recipe.createdAt);
          dateString = date.toLocaleString();
        }

        // Highlight search terms in the content
        let title = recipe.title;
        let ingredients = recipe.ingredients.replace(/\n/g, "<br>");
        let instructions = recipe.instructions.replace(/\n/g, "<br>");

        if (searchTerm) {
          const highlightRegex = new RegExp(`(${searchTerm})`, 'gi');
          title = title.replace(highlightRegex, '<mark>$1</mark>');
          ingredients = ingredients.replace(highlightRegex, '<mark>$1</mark>');
          instructions = instructions.replace(highlightRegex, '<mark>$1</mark>');
        }

        // Create author info for shared recipes or when not logged in
        let authorInfo = "";
        if (currentView === "shared-recipes") {
          authorInfo = `<p class="recipe-author"><strong>By:</strong> ${recipe.userName || 'Anonymous'}</p>`;
        }

        // Create privacy toggle button - ONLY for logged-in users viewing their own recipes
        let privacyButton = "";
        if (currentView === "my-recipes" && isOwner && user) {
          const privacyAction = recipe.isPublic ? "Make Private" : "Make Public";
          privacyButton = `<button class="privacy-btn ${recipe.isPublic ? 'public' : 'private'}" data-id="${recipe.id}" data-public="${recipe.isPublic}">${privacyAction}</button>`;
        }

        // Delete button - ONLY for logged-in users viewing their own recipes
        let deleteButton = "";
        if (currentView === "my-recipes" && isOwner && user) {
          deleteButton = `<button class="delete-btn" data-id="${recipe.id}">Delete</button>`;
        }

        // Privacy status - only show in "my-recipes" view for owned recipes
        let privacyStatus = "";
        if (currentView === "my-recipes" && isOwner && user) {
          privacyStatus = `<p class="privacy-status"><strong>Status:</strong> ${recipe.isPublic ? "Public 🌍" : "Private 🔒"}</p>`;
        }

        // Recipe image - show if available
        let recipeImage = "";
        if (recipe.imageUrl) {
          recipeImage = `<img src="${recipe.imageUrl}" alt="${recipe.title}" class="recipe-image" />`;
        }
  
        card.innerHTML = `
          <h3>${title}</h3>
          ${authorInfo}
          <p class="recipe-created-date"><strong>Created:</strong> ${dateString}</p>
          ${privacyStatus}
          <p><strong>Category:</strong> ${recipe.category || 'N/A'}</p>
          <p><strong>Ingredients:</strong><br>${ingredients}</p>
          <p><strong>Instructions:</strong><br>${instructions}</p>
          ${recipeImage}
          <div class="recipe-actions">
            ${privacyButton}
            ${deleteButton}
          </div>
        `;
  
        recipesContainer.appendChild(card);
      });
  
      // Add event listeners for buttons - only add if user is logged in
      if (user) {
        document.querySelectorAll(".delete-btn").forEach(btn => {
          btn.addEventListener("click", e => {
            const recipeId = e.target.dataset.id;
            if (confirm("Are you sure you want to delete this recipe?")) {
              deleteRecipe(recipeId);
            }
          });
        });

        document.querySelectorAll(".privacy-btn").forEach(btn => {
          btn.addEventListener("click", e => {
            const recipeId = e.target.dataset.id;
            const isCurrentlyPublic = e.target.dataset.public === "true";
            toggleRecipePrivacy(recipeId, isCurrentlyPublic);
          });
        });
      }
    }
  
    form.addEventListener("submit", e => {
      e.preventDefault();
  
      const title = document.getElementById("title").value.trim();
      const ingredients = document.getElementById("ingredients").value.trim();
      const instructions = document.getElementById("instructions").value.trim();
      const category = document.getElementById("category").value.trim();
      const isPublic = document.getElementById("make-public").checked;
      const imageFile = document.getElementById("recipe-image").files[0];
  
      if (title && ingredients && instructions) {
        const recipeData = {
          title,
          ingredients,
          instructions,
          category,
          isPublic
        };
        
        saveRecipe(recipeData, imageFile);
        form.reset();
      }
    });
  
    // Initial render (will show "No recipes yet" until user logs in)
    renderRecipes();
  });