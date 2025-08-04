import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
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

    // Navigation buttons
    const myRecipesBtn = document.getElementById("my-recipes-btn");
    const sharedRecipesBtn = document.getElementById("shared-recipes-btn");
    const bookmarkedRecipesBtn = document.getElementById("bookmarked-recipes-btn");
    const recipesHeading = document.getElementById("recipes-heading");

    // Multi-select functionality
    class MultiSelect {
      constructor(container, onSelectionChange = null) {
        this.container = container;
        this.display = container.querySelector('.multiselect-display');
        this.dropdown = container.querySelector('.multiselect-dropdown');
        this.checkboxes = container.querySelectorAll('input[type="checkbox"]');
        this.selectedValues = [];
        this.onSelectionChange = onSelectionChange;
        
        this.init();
      }
      
      init() {
        this.display.addEventListener('click', () => this.toggleDropdown());
        
        this.checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', () => this.updateSelection());
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
          if (!this.container.contains(e.target)) {
            this.closeDropdown();
          }
        });
      }
      
      toggleDropdown() {
        const isVisible = this.dropdown.style.display === 'block';
        this.dropdown.style.display = isVisible ? 'none' : 'block';
      }
      
      closeDropdown() {
        this.dropdown.style.display = 'none';
      }
      
      updateSelection() {
        this.selectedValues = Array.from(this.checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);
        
        this.updateDisplay();
        
        // Call the callback function if provided
        if (this.onSelectionChange) {
          this.onSelectionChange();
        }
      }
      
      updateDisplay() {
        if (this.selectedValues.length === 0) {
          this.display.innerHTML = '<span style="color: #999;">Select categories...</span>';
        } else {
          this.display.innerHTML = this.selectedValues.map(value => 
            `<span class="category-tag">${value} <span class="remove" data-value="${value}">×</span></span>`
          ).join('');
          
          // Add remove functionality
          this.display.querySelectorAll('.remove').forEach(remove => {
            remove.addEventListener('click', (e) => {
              e.stopPropagation();
              this.removeValue(e.target.dataset.value);
            });
          });
        }
      }
      
      removeValue(value) {
        const checkbox = Array.from(this.checkboxes).find(cb => cb.value === value);
        if (checkbox) {
          checkbox.checked = false;
          this.updateSelection();
        }
      }
      
      setValues(values) {
        this.checkboxes.forEach(cb => cb.checked = values.includes(cb.value));
        this.updateSelection();
      }
      
      getValues() {
        return this.selectedValues;
      }
      
      clear() {
        this.checkboxes.forEach(cb => cb.checked = false);
        this.updateSelection();
      }
    }

    // Rich text editor functionality
    class RichTextEditor {
      constructor(toolbar, editor) {
        this.toolbar = toolbar;
        this.editor = editor;
        this.init();
      }
      
      init() {
        // Add placeholder functionality
        this.updatePlaceholder();
        this.editor.addEventListener('focus', () => this.updatePlaceholder());
        this.editor.addEventListener('blur', () => this.updatePlaceholder());
        this.editor.addEventListener('input', () => this.updatePlaceholder());
        
        // Toolbar buttons
        this.toolbar.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.dataset.command;
            this.execCommand(command);
            this.updateToolbar();
          });
        });
        
        // Update toolbar state on selection change
        this.editor.addEventListener('mouseup', () => this.updateToolbar());
        this.editor.addEventListener('keyup', () => this.updateToolbar());
      }
      
      updatePlaceholder() {
        const placeholder = this.editor.dataset.placeholder;
        if (placeholder && this.editor.textContent.trim() === '') {
          this.editor.setAttribute('data-empty', 'true');
        } else {
          this.editor.removeAttribute('data-empty');
        }
      }
      
      execCommand(command) {
        document.execCommand(command, false, null);
        this.editor.focus();
      }
      
      updateToolbar() {
        this.toolbar.querySelectorAll('button').forEach(btn => {
          const command = btn.dataset.command;
          const isActive = document.queryCommandState(command);
          btn.classList.toggle('active', isActive);
        });
      }
      
      getContent() {
        return this.editor.innerHTML;
      }
      
      setContent(content) {
        this.editor.innerHTML = content;
        this.updatePlaceholder();
      }
      
      clear() {
        this.editor.innerHTML = '';
        this.updatePlaceholder();
      }
    }

    // Store recipes globally
    let recipes = [];
    let filteredRecipes = [];
    let currentView = "shared-recipes"; // "my-recipes", "shared-recipes", "bookmarked-recipes"
    let currentSort = "newest"; // "newest", "oldest", "upvotes"
    let editingRecipeId = null;
    let userBookmarks = []; // Store user's bookmarked recipe IDs

    // Update page heading and navigation button states
    function updatePageHeading() {
      // Update heading
      switch (currentView) {
        case "my-recipes":
          recipesHeading.textContent = "My Recipes";
          break;
        case "shared-recipes":
          recipesHeading.textContent = "Community Recipes";
          break;
        case "bookmarked-recipes":
          recipesHeading.textContent = "Bookmarked Recipes";
          break;
        default:
          recipesHeading.textContent = "All Recipes";
          break;
      }

      // Update button states
      myRecipesBtn.classList.remove('active');
      sharedRecipesBtn.classList.remove('active');
      bookmarkedRecipesBtn.classList.remove('active');

      switch (currentView) {
        case "my-recipes":
          myRecipesBtn.classList.add('active');
          break;
        case "shared-recipes":
          sharedRecipesBtn.classList.add('active');
          break;
        case "bookmarked-recipes":
          bookmarkedRecipesBtn.classList.add('active');
          break;
      }
    }

    // Switch to a specific view
    function switchToView(view) {
      currentView = view;
      updatePageHeading();
      loadRecipes();
    }

    // Search and filter functions
    function filterRecipes() {
      const searchTerm = searchInput.value.toLowerCase().trim();
      const selectedCategories = filterCategoryMultiSelect.getValues();

      filteredRecipes = recipes.filter(recipe => {
        // Check if recipe matches search term (in title, ingredients, or instructions)
        const matchesSearch = !searchTerm || 
          recipe.title.toLowerCase().includes(searchTerm) ||
          recipe.ingredients.toLowerCase().includes(searchTerm) ||
          recipe.instructions.toLowerCase().includes(searchTerm);

        // Check if recipe matches selected categories
        const recipeCategories = recipe.categories || [];
        const matchesCategory = selectedCategories.length === 0 || 
          selectedCategories.some(cat => recipeCategories.includes(cat));

        return matchesSearch && matchesCategory;
      });

      // Apply sorting
      sortRecipes();
      renderRecipes();
    }

    // Sort recipes based on current sort option
    function sortRecipes() {
      filteredRecipes.sort((a, b) => {
        switch (currentSort) {
          case "upvotes":
            const aUpvotes = (a.upvotes || 0);
            const bUpvotes = (b.upvotes || 0);
            return bUpvotes - aUpvotes; // Descending order (most upvotes first)
          
          case "oldest":
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateA - dateB; // Ascending order (oldest first)
          
          case "newest":
          default:
            const newestDateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const newestDateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return newestDateB - newestDateA; // Descending order (newest first)
        }
      });
    }

    // Load user's bookmarks
    async function loadUserBookmarks() {
      const user = auth.currentUser;
      if (!user) {
        userBookmarks = [];
        return;
      }

      try {
        const userDocQuery = query(collection(db, "userProfiles"), where("userId", "==", user.uid));
        const userSnapshot = await getDocs(userDocQuery);
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          userBookmarks = userDoc.data().bookmarks || [];
        } else {
          userBookmarks = [];
        }
      } catch (error) {
        console.error("Error loading bookmarks:", error);
        userBookmarks = [];
      }
    }

    // Create or get user profile document ID
    async function getUserProfileId(userId) {
      try {
        const userDocQuery = query(collection(db, "userProfiles"), where("userId", "==", userId));
        const userSnapshot = await getDocs(userDocQuery);
        
        if (!userSnapshot.empty) {
          return userSnapshot.docs[0].id;
        } else {
          // Create new user profile
          const docRef = await addDoc(collection(db, "userProfiles"), {
            userId: userId,
            userEmail: auth.currentUser.email,
            bookmarks: [],
            createdAt: new Date()
          });
          return docRef.id;
        }
      } catch (error) {
        console.error("Error getting/creating user profile:", error);
        throw error;
      }
    }

    // Toggle bookmark for a recipe
    async function toggleBookmark(recipeId) {
      const user = auth.currentUser;
      if (!user) {
        alert("Please log in to bookmark recipes");
        return;
      }

      try {
        const userProfileId = await getUserProfileId(user.uid);
        const userDocRef = doc(db, "userProfiles", userProfileId);
        
        const isBookmarked = userBookmarks.includes(recipeId);

        if (isBookmarked) {
          await updateDoc(userDocRef, {
            bookmarks: arrayRemove(recipeId)
          });
          userBookmarks = userBookmarks.filter(id => id !== recipeId);
        } else {
          await updateDoc(userDocRef, {
            bookmarks: arrayUnion(recipeId)
          });
          userBookmarks.push(recipeId);
        }

        renderRecipes(); // Re-render to update bookmark buttons
      } catch (error) {
        console.error("Error toggling bookmark:", error);
        alert("Failed to update bookmark: " + error.message);
      }
    }

    // Toggle upvote for a recipe
    async function toggleUpvote(recipeId) {
      const user = auth.currentUser;
      if (!user) {
        alert("Please log in to upvote recipes");
        return;
      }

      try {
        const recipeRef = doc(db, "recipes", recipeId);
        const recipe = recipes.find(r => r.id === recipeId);
        
        if (!recipe) return;

        const userUpvotes = recipe.upvotedBy || [];
        const hasUpvoted = userUpvotes.includes(user.uid);

        // Check if recipe is public before allowing upvote
        if (!recipe.isPublic) {
          alert("You can only upvote public recipes");
          return;
        }

        if (hasUpvoted) {
          // Remove upvote
          await updateDoc(recipeRef, {
            upvotes: increment(-1),
            upvotedBy: arrayRemove(user.uid)
          });
          recipe.upvotes = Math.max(0, (recipe.upvotes || 1) - 1);
          recipe.upvotedBy = userUpvotes.filter(uid => uid !== user.uid);
        } else {
          // Add upvote
          await updateDoc(recipeRef, {
            upvotes: increment(1),
            upvotedBy: arrayUnion(user.uid)
          });
          recipe.upvotes = (recipe.upvotes || 0) + 1;
          recipe.upvotedBy = [...userUpvotes, user.uid];
        }

        renderRecipes(); // Re-render to update upvote buttons and counts
      } catch (error) {
        console.error("Error toggling upvote:", error);
        alert("Failed to update upvote: " + error.message);
      }
    }

    // Initialize multi-selects and rich text editors
    const categoryMultiSelect = new MultiSelect(document.querySelector('#category-display').parentNode);
    const filterCategoryMultiSelect = new MultiSelect(document.querySelector('#filter-category-display').parentNode, filterRecipes);
    const editCategoryMultiSelect = new MultiSelect(document.querySelector('#edit-category-display').parentNode);

    const ingredientsEditor = new RichTextEditor(
      document.getElementById('ingredients-toolbar'),
      document.getElementById('ingredients')
    );
    const instructionsEditor = new RichTextEditor(
      document.getElementById('instructions-toolbar'),
      document.getElementById('instructions')
    );
    const editIngredientsEditor = new RichTextEditor(
      document.getElementById('edit-ingredients-toolbar'),
      document.getElementById('edit-ingredients')
    );
    const editInstructionsEditor = new RichTextEditor(
      document.getElementById('edit-instructions-toolbar'),
      document.getElementById('edit-instructions')
    );

    // Navigation button event listeners
    myRecipesBtn.addEventListener("click", () => switchToView("my-recipes"));
    sharedRecipesBtn.addEventListener("click", () => switchToView("shared-recipes"));
    bookmarkedRecipesBtn.addEventListener("click", () => {
      const user = auth.currentUser;
      if (!user) {
        alert("Please log in to view bookmarked recipes.");
        return;
      }
      switchToView("bookmarked-recipes");
    });

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
        myRecipesBtn.style.display = "inline-block";
        sharedRecipesBtn.style.display = "inline-block";
        bookmarkedRecipesBtn.style.display = "inline-block";
        logoutBtn.style.display = "inline-block";
        loginBtn.style.display = "none";
        signupBtn.style.display = "none";
        googleSignInBtn.style.display = "none";
        emailInput.style.display = "none";
        passwordInput.style.display = "none";
        
        // Reset to my recipes view and load user's recipes when they log in
        currentView = "my-recipes";
        updatePageHeading();
        loadUserBookmarks().then(() => loadRecipes());
    } else {
        // User is logged out - show shared recipes by default
        addRecipeSection.style.display = "none";
        myRecipesBtn.style.display = "none";
        bookmarkedRecipesBtn.style.display = "none";
        logoutBtn.style.display = "none";
        sharedRecipesBtn.style.display = "none";
        loginBtn.style.display = "inline-block";
        signupBtn.style.display = "inline-block";
        googleSignInBtn.style.display = "inline-block";
        emailInput.style.display = "inline-block";
        passwordInput.style.display = "inline-block";
        
        // Clear search/filters and show shared recipes for logged-out users
        searchInput.value = "";
        filterCategoryMultiSelect.clear();
        currentView = "shared-recipes"; // Default to shared recipes for logged-out users
        userBookmarks = []; // Clear bookmarks
        updatePageHeading();
        loadRecipes(); // Load shared recipes even when logged out
    }
    });

    const form = document.getElementById("recipe-form");
    const recipesContainer = document.getElementById("recipes");
    const searchInput = document.getElementById("search-input");
    const sortSelect = document.getElementById("sort-select");

    // Sort functionality
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        currentSort = e.target.value;
        filterRecipes(); // This will also trigger sorting and re-rendering
      });
    }

    // Modal elements
    const editModal = document.getElementById("edit-modal");
    const editForm = document.getElementById("edit-recipe-form");
    const closeModal = document.querySelector(".close");
    const cancelEdit = document.getElementById("cancel-edit");

    // Add event listeners for search and filter
    searchInput.addEventListener("input", filterRecipes);
  
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
      } else if (currentView === "bookmarked-recipes") {
        // Load bookmarked recipes (requires login)
        const user = auth.currentUser;
        if (!user || userBookmarks.length === 0) {
          recipes = [];
          filteredRecipes = [];
          renderRecipes();
          return;
        }
        
        // For bookmarked recipes, we need to load each recipe individually
        // because we can't efficiently query for multiple specific document IDs in Firestore
        recipes = [];
        
        // Load each bookmarked recipe
        for (const recipeId of userBookmarks) {
          try {
            const recipeDoc = await getDocs(query(collection(db, "recipes"), where("__name__", "==", recipeId)));
            if (!recipeDoc.empty) {
              const docData = recipeDoc.docs[0];
              const recipeData = {
                id: docData.id,
                ...docData.data()
              };
              
              // Include the recipe if:
              // 1. It's public, OR
              // 2. It's the user's own recipe (even if private)
              if (recipeData.isPublic || recipeData.userId === user.uid) {
                recipes.push(recipeData);
              }
            }
          } catch (error) {
            console.error(`Error loading bookmarked recipe ${recipeId}:`, error);
          }
        }
        
        // Apply current filters after loading
        filterRecipes();
        return;
      } else {
        // Load shared recipes (available to everyone, including logged-out users)
        q = query(collection(db, "recipes"), where("isPublic", "==", true));
      }
  
      const querySnapshot = await getDocs(q);
      
      recipes = [];
      querySnapshot.forEach((doc) => {
        const recipeData = {
          id: doc.id,
          ...doc.data()
        };
        recipes.push(recipeData);
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
          imageUrl: null, // Will be updated if image is uploaded
          upvotes: 0, // Initialize upvotes to 0
          upvotedBy: [] // Initialize empty array of users who upvoted
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

    // Update recipe in Firestore
    async function updateRecipe(recipeId, recipeData, imageFile = null) {
      try {
        const user = auth.currentUser;
        if (!user) {
          alert("You must be logged in to update recipes");
          return;
        }

        const recipeRef = doc(db, "recipes", recipeId);
        
        // If there's a new image, upload it first
        if (imageFile) {
          try {
            const imageUrl = await uploadImage(imageFile, recipeId);
            recipeData.imageUrl = imageUrl;
          } catch (imageError) {
            console.error("Error uploading image:", imageError);
            alert("Recipe updated but image upload failed: " + imageError.message);
          }
        }

        await updateDoc(recipeRef, recipeData);
        console.log("Recipe updated successfully");
        loadRecipes(); // Reload and reapply filters
      } catch (error) {
        console.error("Error updating recipe:", error);
        alert("Failed to update recipe: " + error.message);
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

    // Open edit modal
    function openEditModal(recipe) {
      editingRecipeId = recipe.id;
      
      // Populate form with recipe data
      document.getElementById("edit-title").value = recipe.title;
      editCategoryMultiSelect.setValues(recipe.categories || []);
      editIngredientsEditor.setContent(recipe.ingredients || '');
      editInstructionsEditor.setContent(recipe.instructions || '');
      document.getElementById("edit-make-public").checked = recipe.isPublic || false;
      
      // Show modal
      editModal.style.display = "block";
    }

    // Close edit modal
    function closeEditModal() {
      editModal.style.display = "none";
      editingRecipeId = null;
      editForm.reset();
      editCategoryMultiSelect.clear();
      editIngredientsEditor.clear();
      editInstructionsEditor.clear();
    }

    // Modal event listeners
    closeModal.addEventListener("click", closeEditModal);
    cancelEdit.addEventListener("click", closeEditModal);
    
    window.addEventListener("click", (e) => {
      if (e.target === editModal) {
        closeEditModal();
      }
    });
  
    function renderRecipes() {
      recipesContainer.innerHTML = "";
      
      // Use filtered recipes for rendering
      const recipesToRender = filteredRecipes;
      const searchTerm = searchInput.value.toLowerCase().trim();
      const selectedCategories = filterCategoryMultiSelect.getValues();
      const user = auth.currentUser;
  
      if (recipesToRender.length === 0) {
        if (recipes.length === 0) {
          let message;
          if (currentView === "my-recipes") {
            message = "No recipes yet. Create your first recipe!";
          } else if (currentView === "bookmarked-recipes") {
            message = "No bookmarked recipes yet. Bookmark some recipes to see them here!";
          } else {
            message = user ? 
              "No shared recipes found. Be the first to share a recipe!" : 
              "No shared recipes found. Log in to create and share your own recipes!";
          }
          recipesContainer.innerHTML = `<p>${message}</p>`;
        } else {
          // Show message when no recipes match the current filters
          let message = "No recipes found";
          if (searchTerm && selectedCategories.length > 0) {
            message += ` matching "${searchTerm}" in categories "${selectedCategories.join(', ')}".`;
          } else if (searchTerm) {
            message += ` matching "${searchTerm}".`;
          } else if (selectedCategories.length > 0) {
            message += ` in categories "${selectedCategories.join(', ')}".`;
          }
          recipesContainer.innerHTML = `<p>${message}</p>`;
        }
        return;
      }

      // Add results count and view info
      const headerInfo = document.createElement("div");
      headerInfo.className = "recipes-header-info";
      
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
        const isBookmarked = user && userBookmarks.includes(recipe.id);
        const hasUpvoted = user && recipe.upvotedBy && recipe.upvotedBy.includes(user.uid);

        // Format the createdAt date
        let dateString = "Unknown date";
        if (recipe.createdAt) {
          const date = recipe.createdAt.toDate ? recipe.createdAt.toDate() : new Date(recipe.createdAt);
          dateString = date.toLocaleString();
        }

        // Highlight search terms in the content
        let title = recipe.title;
        let ingredients = recipe.ingredients || '';
        let instructions = recipe.instructions || '';

        if (searchTerm) {
          const highlightRegex = new RegExp(`(${searchTerm})`, 'gi');
          title = title.replace(highlightRegex, '<mark>$1</mark>');
          ingredients = ingredients.replace(highlightRegex, '<mark>$1</mark>');
          instructions = instructions.replace(highlightRegex, '<mark>$1</mark>');
        }

        // Create author info for shared recipes or when not logged in
        let authorInfo = "";
        if (currentView === "shared-recipes" || currentView === "bookmarked-recipes") {
          authorInfo = `<p class="recipe-author"><strong>By:</strong> ${recipe.userName || 'Anonymous'}</p>`;
        }

        // Create privacy toggle button - ONLY for logged-in users viewing their own recipes
        let privacyButton = "";
        if (currentView === "my-recipes" && isOwner && user) {
          const privacyAction = recipe.isPublic ? "🔒 Make Private" : "🌍 Make Public";
          privacyButton = `<button class="privacy-btn ${recipe.isPublic ? 'public' : 'private'}" data-id="${recipe.id}" data-public="${recipe.isPublic}">${privacyAction}</button>`;
        }

        // Edit button - ONLY for logged-in users viewing their own recipes
        let editButton = "";
        if (currentView === "my-recipes" && isOwner && user) {
          editButton = `<button class="edit-btn" data-id="${recipe.id}">Edit</button>`;
        }

        // Bookmark button - for ALL logged-in users on ALL recipes (including their own)
        let bookmarkButton = "";
        if (user) {
          const bookmarkAction = isBookmarked ? "Bookmarked" : "Bookmark";
          const bookmarkClass = isBookmarked ? "bookmarked" : "";
          bookmarkButton = `<button class="bookmark-btn ${bookmarkClass}" data-id="${recipe.id}">${isBookmarked ? '📖' : '📝'} ${bookmarkAction}</button>`;
        }

        // Delete button - ONLY for logged-in users viewing their own recipes
        let deleteButton = "";
        if (currentView === "my-recipes" && isOwner && user) {
          deleteButton = `<div class="delete-btn-wrapper"><button class="delete-btn" data-id="${recipe.id}">Delete</button></div>`;
        }

        // Upvote button - for ALL logged-in users on ALL public recipes (including their own)
        let upvoteButton = "";
        if (user && recipe.isPublic) {
          const upvoteClass = hasUpvoted ? "upvoted" : "";
          upvoteButton = `<button class="upvote-btn ${upvoteClass}" data-id="${recipe.id}">${hasUpvoted ? '👍 Upvoted' : '👍 Upvote'}</button>`;
        }

        // Privacy status - only show in "my-recipes" view for owned recipes
        let privacyStatus = "";
        if (currentView === "my-recipes" && isOwner && user) {
          privacyStatus = `<p class="privacy-status"><strong>Status:</strong> ${recipe.isPublic ? "Public 🌍" : "Private 🔒"}</p>`;
        }

        // Upvote count display in top right corner for public recipes
        let upvoteCorner = "";
        if (recipe.isPublic) {
          upvoteCorner = `<div class="recipe-upvote-corner">👍 ${recipe.upvotes || 0}</div>`;
        }

        // Recipe image - show if available
        let recipeImage = "";
        if (recipe.imageUrl) {
          recipeImage = `<img src="${recipe.imageUrl}" alt="${recipe.title}" class="recipe-image" onclick="window.open('${recipe.imageUrl}', '_blank')" />`;
        }

        // Categories display
        const categoriesDisplay = recipe.categories && recipe.categories.length > 0 
          ? recipe.categories.map(cat => `<span class="category-tag">${cat}</span>`).join(' ')
          : 'N/A';
  
        card.innerHTML = `
          ${upvoteCorner}
          <h3>${title}</h3>
          ${authorInfo}
          <p class="recipe-created-date"><strong>Created:</strong> ${dateString}</p>
          ${privacyStatus}
          <p><strong>Categories:</strong> ${categoriesDisplay}</p>
          <div class="recipe-content">
            <p><strong>Ingredients:</strong></p>
            <div>${ingredients}</div>
            <p><strong>Instructions:</strong></p>
            <div>${instructions}</div>
          </div>
          ${recipeImage}
          <div class="recipe-actions">
            ${editButton}
            ${privacyButton}
            ${bookmarkButton}
            ${upvoteButton}
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

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", e => {
            const recipeId = e.target.dataset.id;
            const recipe = recipes.find(r => r.id === recipeId);
            if (recipe) {
              openEditModal(recipe);
            }
          });
        });

        document.querySelectorAll(".bookmark-btn").forEach(btn => {
          btn.addEventListener("click", e => {
            const recipeId = e.target.dataset.id;
            toggleBookmark(recipeId);
          });
        });

        document.querySelectorAll(".upvote-btn").forEach(btn => {
          btn.addEventListener("click", e => {
            const recipeId = e.target.dataset.id;
            toggleUpvote(recipeId);
          });
        });
      }
    }
  
    // Add recipe form submission
    form.addEventListener("submit", e => {
      e.preventDefault();
  
      const title = document.getElementById("title").value.trim();
      const ingredients = ingredientsEditor.getContent();
      const instructions = instructionsEditor.getContent();
      const categories = categoryMultiSelect.getValues();
      const isPublic = document.getElementById("make-public").checked;
      const imageFile = document.getElementById("recipe-image").files[0];
  
      if (title && ingredients && instructions) {
        const recipeData = {
          title,
          ingredients,
          instructions,
          categories,
          isPublic
        };
        
        saveRecipe(recipeData, imageFile);
        
        // Reset form
        form.reset();
        categoryMultiSelect.clear();
        ingredientsEditor.clear();
        instructionsEditor.clear();
      }
    });

    // Edit recipe form submission
    editForm.addEventListener("submit", e => {
      e.preventDefault();
  
      const title = document.getElementById("edit-title").value.trim();
      const ingredients = editIngredientsEditor.getContent();
      const instructions = editInstructionsEditor.getContent();
      const categories = editCategoryMultiSelect.getValues();
      const isPublic = document.getElementById("edit-make-public").checked;
      const imageFile = document.getElementById("edit-recipe-image").files[0];
  
      if (title && ingredients && instructions && editingRecipeId) {
        const recipeData = {
          title,
          ingredients,
          instructions,
          categories,
          isPublic
        };
        
        updateRecipe(editingRecipeId, recipeData, imageFile);
        closeEditModal();
      }
    });
  
    // Initial render (will show "No recipes yet" until user logs in)
    renderRecipes();
  });