document.addEventListener('DOMContentLoaded', () => {
    // --- View Elements ---
    const recipeListView = document.getElementById('recipe-list-view');
    const recipeDetailView = document.getElementById('recipe-detail-view');
    const recipeFormView = document.getElementById('recipe-form-view');

    // --- List View Elements ---
    const recipeListContainer = document.getElementById('recipe-list-container');
    const addNewRecipeButton = document.getElementById('add-new-recipe-button');

    // --- Detail View Elements ---
    const recipeContent = document.getElementById('recipe-content');
    const backButton = document.getElementById('back-button');
    const wakeLockButton = document.getElementById('wake-lock-button');
    const cookedButton = document.getElementById('cooked-button');
    const editRecipeButton = document.getElementById('edit-recipe-button');
    const deleteRecipeButton = document.getElementById('delete-recipe-button');
    const detailLastCookedDateEl = document.getElementById('detail-last-cooked-date');
    const detailLastMarkedDateEl = document.getElementById('detail-last-marked-date');

    // --- Form View Elements ---
    const recipeForm = document.getElementById('recipe-form');
    const formTitle = document.getElementById('form-title');
    const recipeIdInput = document.getElementById('recipe-id-input');
    const recipeNameInput = document.getElementById('recipe-name');
    const recipeTimeInput = document.getElementById('recipe-time');
    const ingredientGroupsContainer = document.getElementById('ingredient-groups-container');
    const addIngredientGroupButton = document.getElementById('add-ingredient-group-button');
    const instructionsContainer = document.getElementById('instructions-container');
    const addInstructionButton = document.getElementById('add-instruction-button');
    const saveRecipeButton = document.getElementById('save-recipe-button');
    const cancelFormButton = document.getElementById('cancel-form-button');

    // --- State Variables ---
    let allRecipes = []; // This will hold recipes from localStorage
    let cookedData = {};
    let currentRecipeId = null;
    let wakeLock = null;

    // --- Constants ---
    const RECIPES_STORAGE_KEY = 'cookmate_recipes';
    const COOKED_DATA_STORAGE_KEY = 'cookmate_cooked_data';

    // --- INITIALIZATION ---
    async function initializeApp() {
        await loadRecipesAndCookedData();
        renderRecipeList();
        setupEventListeners();
    }

    // --- DATA MANAGEMENT (LocalStorage & Seeding) ---
    async function loadRecipesAndCookedData() {
        // Load cooked data first
        const storedCookedData = localStorage.getItem(COOKED_DATA_STORAGE_KEY);
        cookedData = storedCookedData ? JSON.parse(storedCookedData) : {};

        // Load recipes
        let storedRecipes = localStorage.getItem(RECIPES_STORAGE_KEY);
        if (!storedRecipes) {
            // Seed from recipes.json if localStorage is empty
            try {
                const response = await fetch('recipes.json');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const seedRecipes = await response.json();
                // Ensure seed recipes have a basic structure compatible with new features
                allRecipes = seedRecipes.map(recipe => ({
                    ...recipe,
                    id: recipe.id || generateId(), // Ensure ID
                    dateAdded: recipe.dateAdded || new Date().toISOString(), // Add dateAdded if missing
                    // Convert old simple ingredients array to new grouped structure if necessary
                    ingredients: convertToGroupedIngredients(recipe.ingredients),
                    lastCooked: null, // Initialize if not present
                    lastMarkedAsCooked: null // Initialize if not present
                }));
                saveRecipesToLocalStorage();
                console.log("Seeded recipes from recipes.json to localStorage.");
            } catch (error) {
                console.error("Error seeding recipes from recipes.json:", error);
                allRecipes = []; // Start with empty if seeding fails
            }
        } else {
            allRecipes = JSON.parse(storedRecipes);
        }
        // Ensure cookedData has entries for all recipes
        allRecipes.forEach(recipe => {
            if (!cookedData[recipe.id]) {
                cookedData[recipe.id] = { lastCooked: null, lastMarkedAsCooked: null };
            }
        });
    }

    function convertToGroupedIngredients(ingredientsArray) {
        if (!ingredientsArray) return [{ groupName: "", items: [] }]; // Default empty group
        // If it's already in the new format (array of objects with groupName/items)
        if (Array.isArray(ingredientsArray) && ingredientsArray.length > 0 && typeof ingredientsArray[0] === 'object' && 'items' in ingredientsArray[0]) {
            return ingredientsArray;
        }
        // If it's the old simple array of strings, wrap it in a default group
        if (Array.isArray(ingredientsArray) && (ingredientsArray.length === 0 || typeof ingredientsArray[0] === 'string')) {
            return [{ groupName: "", items: ingredientsArray }];
        }
        return [{ groupName: "", items: [] }]; // Fallback
    }


    function saveRecipesToLocalStorage() {
        localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(allRecipes));
    }

    function saveCookedDataToLocalStorage() {
        localStorage.setItem(COOKED_DATA_STORAGE_KEY, JSON.stringify(cookedData));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // --- VIEW RENDERING & SWITCHING ---
    function showView(viewToShow) {
        [recipeListView, recipeDetailView, recipeFormView].forEach(view => {
            view.classList.remove('active');
        });
        viewToShow.classList.add('active');
        window.scrollTo(0, 0); // Scroll to top when changing views
    }

    function renderRecipeList() {
        recipeListContainer.innerHTML = '';
        if (allRecipes.length === 0) {
            recipeListContainer.innerHTML = '<p>No recipes yet. Click "Add New Recipe" to get started!</p>';
            return;
        }
        allRecipes.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0)); // Show newest first

        allRecipes.forEach(recipe => {
            const card = document.createElement('div');
            card.classList.add('recipe-card');
            card.dataset.recipeId = recipe.id;

            const recipeCookedInfo = cookedData[recipe.id] || { lastCooked: null };
            const lastCookedFormatted = formatDate(recipeCookedInfo.lastCooked);

            card.innerHTML = `
                <h3>${recipe.name}</h3>
                <p>Est. Time: ${recipe.estimatedTime}</p>
                <p class="last-cooked-date">Last Cooked: ${lastCookedFormatted}</p>
            `;
            card.addEventListener('click', () => showRecipeDetail(recipe.id));
            recipeListContainer.appendChild(card);
        });
    }

    function showRecipeDetail(recipeId) {
        const recipe = allRecipes.find(r => r.id === recipeId);
        if (!recipe) return;
        currentRecipeId = recipeId;

        let ingredientsHtml = '';
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
            recipe.ingredients.forEach(group => {
                if (group.groupName) {
                    ingredientsHtml += `<h4 class="ingredient-group-title">${escapeHtml(group.groupName)}</h4>`;
                }
                if (group.items && group.items.length > 0) {
                    ingredientsHtml += `<ul class="ingredient-group-list">`;
                    group.items.forEach(item => {
                        ingredientsHtml += `<li>${escapeHtml(item)}</li>`;
                    });
                    ingredientsHtml += `</ul>`;
                } else if (!group.groupName && group.items && group.items.length === 0 && recipe.ingredients.length === 1){
                    // Handles case of a single empty default group
                    ingredientsHtml += `<p><em>No ingredients listed.</em></p>`;
                }
            });
        } else {
            ingredientsHtml = '<p><em>No ingredients listed.</em></p>';
        }


        const instructionsList = recipe.instructions.map(step => `<li>${escapeHtml(step)}</li>`).join('');

        recipeContent.innerHTML = `
            <h2>${escapeHtml(recipe.name)}</h2>
            <p><strong>Estimated Cooking Time:</strong> ${escapeHtml(recipe.estimatedTime)}</p>
            <p><em>Added on: ${formatDate(recipe.dateAdded)}</em></p>
            <h3>Ingredients</h3>
            ${ingredientsHtml || '<p>No ingredients listed.</p>'}
            <h3>Instructions</h3>
            ${instructionsList ? `<ol>${instructionsList}</ol>` : '<p>No instructions provided.</p>'}
        `;
        updateDetailCookedDates(recipeId);
        updateWakeLockButton(false); // Reset wake lock button state
        showView(recipeDetailView);
    }

    function updateDetailCookedDates(recipeId) {
        const recipeCookedInfo = cookedData[recipeId] || { lastCooked: null, lastMarkedAsCooked: null };
        detailLastCookedDateEl.textContent = formatDate(recipeCookedInfo.lastCooked);
        detailLastMarkedDateEl.textContent = formatDate(recipeCookedInfo.lastMarkedAsCooked, true);
    }

    // --- RECIPE FORM HANDLING ---
    function showRecipeForm(recipeToEdit = null) {
        recipeForm.reset();
        ingredientGroupsContainer.innerHTML = ''; // Clear previous dynamic fields
        instructionsContainer.innerHTML = '';

        if (recipeToEdit) {
            formTitle.textContent = 'Edit Recipe';
            recipeIdInput.value = recipeToEdit.id;
            recipeNameInput.value = recipeToEdit.name;
            recipeTimeInput.value = recipeToEdit.estimatedTime;

            (recipeToEdit.ingredients || [{ groupName: "", items: [] }]).forEach(group => {
                addIngredientGroupToForm(group.groupName, group.items);
            });

            (recipeToEdit.instructions || []).forEach(instruction => {
                addInstructionToForm(instruction);
            });
        } else {
            formTitle.textContent = 'Add New Recipe';
            recipeIdInput.value = ''; // Clear ID for new recipe
            // Add one default empty ingredient group for new recipes
            addIngredientGroupToForm("", []);
            addInstructionToForm(""); // Add one empty instruction field
        }
        showView(recipeFormView);
    }

    function addIngredientGroupToForm(groupName = "", items = []) {
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('ingredient-group-container'); // Wrapper for group name and items

        const groupHeaderDiv = document.createElement('div');
        groupHeaderDiv.classList.add('ingredient-group-header');

        const groupNameInput = document.createElement('input');
        groupNameInput.type = 'text';
        groupNameInput.placeholder = 'Group Name (e.g., For the Sauce)';
        groupNameInput.value = groupName;
        groupNameInput.classList.add('ingredient-group-name-input');
        groupHeaderDiv.appendChild(groupNameInput);

        const removeGroupButton = document.createElement('button');
        removeGroupButton.type = 'button';
        removeGroupButton.textContent = 'Remove Group';
        removeGroupButton.classList.add('remove-item-button');
        removeGroupButton.onclick = () => groupDiv.remove();
        groupHeaderDiv.appendChild(removeGroupButton);
        groupDiv.appendChild(groupHeaderDiv);

        const itemsDiv = document.createElement('div');
        itemsDiv.classList.add('ingredient-group-items');
        groupDiv.appendChild(itemsDiv);

        items.forEach(itemText => addIngredientItemToForm(itemsDiv, itemText));

        const addItemButton = document.createElement('button');
        addItemButton.type = 'button';
        addItemButton.textContent = 'Add Ingredient to this Group';
        addItemButton.classList.add('button-tertiary', 'add-ingredient-item-button');
        addItemButton.onclick = () => addIngredientItemToForm(itemsDiv);
        groupDiv.appendChild(addItemButton);

        ingredientGroupsContainer.appendChild(groupDiv);
    }

    function addIngredientItemToForm(parentItemsDiv, itemText = "") {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('ingredient-item'); // Changed class for clarity
        itemDiv.style.display = 'flex';
        itemDiv.style.gap = '0.5rem';
        itemDiv.style.marginBottom = '0.5rem';

        const itemInput = document.createElement('input');
        itemInput.type = 'text';
        itemInput.placeholder = 'e.g., 1 cup flour';
        itemInput.value = itemText;
        itemInput.required = true; // Make individual ingredients required if field exists
        itemInput.style.flexGrow = '1';
        itemDiv.appendChild(itemInput);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'X';
        removeButton.classList.add('remove-item-button');
        removeButton.onclick = () => itemDiv.remove();
        itemDiv.appendChild(removeButton);

        parentItemsDiv.appendChild(itemDiv);
    }

    function addInstructionToForm(instructionText = "") {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('instruction-item');
        itemDiv.style.display = 'flex';
        itemDiv.style.gap = '0.5rem';
        itemDiv.style.marginBottom = '0.5rem';

        const itemInput = document.createElement('input');
        itemInput.type = 'text';
        itemInput.placeholder = 'e.g., Mix all ingredients';
        itemInput.value = instructionText;
        itemInput.required = true;
        itemInput.style.flexGrow = '1';
        itemDiv.appendChild(itemInput);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'X';
        removeButton.classList.add('remove-item-button');
        removeButton.onclick = () => itemDiv.remove();
        itemDiv.appendChild(removeButton);

        instructionsContainer.appendChild(itemDiv);
    }

    recipeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = recipeIdInput.value;
        const name = recipeNameInput.value.trim();
        const estimatedTime = recipeTimeInput.value.trim();

        if (!name || !estimatedTime) {
            alert("Recipe Name and Estimated Time are required.");
            return;
        }

        const ingredients = [];
        document.querySelectorAll('#ingredient-groups-container .ingredient-group-container').forEach(groupEl => {
            const groupName = groupEl.querySelector('.ingredient-group-name-input').value.trim();
            const items = [];
            groupEl.querySelectorAll('.ingredient-group-items .ingredient-item input[type="text"]').forEach(itemInputEl => {
                const itemText = itemInputEl.value.trim();
                if (itemText) items.push(itemText);
            });
            // Only add group if it has a name or items
            if (groupName || items.length > 0) {
                 ingredients.push({ groupName, items });
            }
        });
         // If no groups were added but user might expect empty array
        if (ingredients.length === 0 && document.querySelectorAll('#ingredient-groups-container .ingredient-group-container').length > 0) {
            ingredients.push({ groupName: "", items: [] }); // Ensure at least one empty default group if form had groups
        }


        const instructions = [];
        document.querySelectorAll('#instructions-container .instruction-item input[type="text"]').forEach(inputEl => {
            const instructionText = inputEl.value.trim();
            if (instructionText) instructions.push(instructionText);
        });

        const recipeData = {
            name,
            estimatedTime,
            ingredients,
            instructions,
            // lastCooked and lastMarkedAsCooked will be preserved if editing, or null if new
        };

        if (id) { // Editing existing recipe
            const index = allRecipes.findIndex(r => r.id === id);
            if (index > -1) {
                allRecipes[index] = { ...allRecipes[index], ...recipeData }; // Merge, preserving id, dateAdded etc.
            }
        } else { // Adding new recipe
            recipeData.id = generateId();
            recipeData.dateAdded = new Date().toISOString();
            recipeData.lastCooked = null;
            recipeData.lastMarkedAsCooked = null;
            allRecipes.push(recipeData);
            // Ensure new recipe has cookedData entry
            if (!cookedData[recipeData.id]) {
                cookedData[recipeData.id] = { lastCooked: null, lastMarkedAsCooked: null };
            }
        }

        saveRecipesToLocalStorage();
        saveCookedDataToLocalStorage(); // Save cookedData in case new recipe was added
        renderRecipeList();
        showView(recipeListView);
    });


    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        addNewRecipeButton.addEventListener('click', () => showRecipeForm());
        backButton.addEventListener('click', () => showView(recipeListView)); // Go back to list from detail
        cancelFormButton.addEventListener('click', () => showView(recipeListView)); // Go back to list from form

        addIngredientGroupButton.addEventListener('click', () => addIngredientGroupToForm());
        addInstructionButton.addEventListener('click', () => addInstructionToForm());

        editRecipeButton.addEventListener('click', () => {
            if (!currentRecipeId) return;
            const recipeToEdit = allRecipes.find(r => r.id === currentRecipeId);
            if (recipeToEdit) showRecipeForm(recipeToEdit);
        });

        deleteRecipeButton.addEventListener('click', () => {
            if (!currentRecipeId) return;
            const recipeToDelete = allRecipes.find(r => r.id === currentRecipeId);
            if (recipeToDelete && confirm(`Are you sure you want to delete "${recipeToDelete.name}"?`)) {
                allRecipes = allRecipes.filter(r => r.id !== currentRecipeId);
                delete cookedData[currentRecipeId]; // Remove associated cooked data
                saveRecipesToLocalStorage();
                saveCookedDataToLocalStorage();
                renderRecipeList();
                showView(recipeListView);
            }
        });

        cookedButton.addEventListener('click', () => {
            if (!currentRecipeId) return;
            const now = new Date().toISOString();
            if (!cookedData[currentRecipeId]) cookedData[currentRecipeId] = {};
            cookedData[currentRecipeId].lastCooked = now;
            cookedData[currentRecipeId].lastMarkedAsCooked = now;
            saveCookedDataToLocalStorage();
            updateDetailCookedDates(currentRecipeId);
        });

        wakeLockButton.addEventListener('click', () => {
            if (wakeLock === null) requestWakeLock();
            else releaseWakeLock();
        });
    }

    // --- SCREEN WAKE LOCK ---
    async function requestWakeLock() { /* ... (same as before) ... */ }
    function releaseWakeLock() { /* ... (same as before) ... */ }
    async function handleVisibilityChange() { /* ... (same as before) ... */ }
    function updateWakeLockButton(isActive) { /* ... (same as before) ... */ }
    // Copy the Screen Wake Lock functions from your previous script.js here.
    // For brevity, I'm omitting them, but they are needed.
    // Ensure the wakeLockButton element is correctly selected at the top.

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                updateWakeLockButton(true);
                document.addEventListener('visibilitychange', handleVisibilityChange);
                 wakeLock.addEventListener('release', () => { // Listen for release event
                    if (wakeLock) { // only if wakeLock was not null (i.e. programmatically released by browser)
                        updateWakeLockButton(false);
                        wakeLock = null;
                    }
                 });
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
                updateWakeLockButton(false);
            }
        } else {
            updateWakeLockButton(false); // API not supported
        }
    }

    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release(); // This will trigger the 'release' event if successful
            wakeLock = null; // Assume release, update UI immediately
            updateWakeLockButton(false);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    }

     async function handleVisibilityChange() { // Renamed for clarity
        if (document.visibilityState === 'visible' && wakeLockButton.classList.contains('active')) {
            // If tab becomes visible AND wake lock was supposed to be active, re-request
            await requestWakeLock();
        }
    }

    function updateWakeLockButton(isActive) {
        if (isActive) {
            wakeLockButton.textContent = 'Keep Screen Awake: ON';
            wakeLockButton.classList.add('active');
        } else {
            wakeLockButton.textContent = 'Keep Screen Awake: OFF';
            wakeLockButton.classList.remove('active');
        }
    }


    // --- UTILITY FUNCTIONS ---
    function formatDate(dateString, includeTime = false) {
        if (!dateString) return "Never";
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "Invalid Date";
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            if (includeTime) {
                options.hour = 'numeric';
                options.minute = '2-digit';
                options.hour12 = true;
            }
            return date.toLocaleDateString(undefined, options);
        } catch (error) {
            return "Error";
        }
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """")
             .replace(/'/g, "'");
    }

    // --- Start the App ---
    initializeApp();
});