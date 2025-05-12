document.addEventListener('DOMContentLoaded', () => {
    const recipeListView = document.getElementById('recipe-list-view');
    const recipeDetailView = document.getElementById('recipe-detail-view');
    const recipeListContainer = document.getElementById('recipe-list-container');
    const recipeContent = document.getElementById('recipe-content');
    const backButton = document.getElementById('back-button');
    const wakeLockButton = document.getElementById('wake-lock-button');
    const cookedButton = document.getElementById('cooked-button');
    const detailLastCookedDateEl = document.getElementById('detail-last-cooked-date');
    const detailLastMarkedDateEl = document.getElementById('detail-last-marked-date');

    let recipes = [];
    let cookedData = {}; // Stores { recipeId: { lastCooked: dateISOString, lastMarkedAsCooked: dateISOString } }
    let currentRecipeId = null;
    let wakeLock = null; // Stores the Screen Wake Lock object

    const COOKED_DATA_STORAGE_KEY = 'cookmate_cooked_data';

    // --- Data Loading and Saving ---

    async function loadRecipes() {
        try {
            const response = await fetch('recipes.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            recipes = await response.json();
            loadCookedData(); // Load saved dates after recipes are loaded
            renderRecipeList();
        } catch (error) {
            console.error("Error loading recipes:", error);
            recipeListContainer.innerHTML = '<p style="color: red;">Could not load recipes. Please check the console.</p>';
        }
    }

    function loadCookedData() {
        const storedData = localStorage.getItem(COOKED_DATA_STORAGE_KEY);
        if (storedData) {
            try {
                cookedData = JSON.parse(storedData);
                 // Basic validation (ensure it's an object)
                if (typeof cookedData !== 'object' || cookedData === null) {
                    console.warn("Invalid cooked data found in localStorage. Resetting.");
                    cookedData = {};
                }
            } catch (error) {
                 console.error("Error parsing cooked data from localStorage:", error);
                 cookedData = {}; // Reset on parsing error
            }

        } else {
            cookedData = {};
        }
         // Ensure all recipes have an entry in cookedData (for consistency)
        recipes.forEach(recipe => {
            if (!cookedData[recipe.id]) {
                cookedData[recipe.id] = { lastCooked: null, lastMarkedAsCooked: null };
            }
        });
    }


    function saveCookedData() {
        try {
             localStorage.setItem(COOKED_DATA_STORAGE_KEY, JSON.stringify(cookedData));
        } catch (error) {
            console.error("Error saving cooked data to localStorage:", error);
            alert("Could not save the 'last cooked' date. Local storage might be full or disabled.");
        }
    }

    // --- Rendering ---

    function renderRecipeList() {
        recipeListContainer.innerHTML = ''; // Clear previous list
        if (recipes.length === 0) {
            recipeListContainer.innerHTML = '<p>No recipes found.</p>';
            return;
        }

        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.classList.add('recipe-card');
            card.dataset.recipeId = recipe.id; // Store ID for click handling

            const recipeCookedInfo = cookedData[recipe.id] || { lastCooked: null }; // Handle missing data just in case
            const lastCookedFormatted = formatDate(recipeCookedInfo.lastCooked);

            card.innerHTML = `
                <h3>${recipe.name}</h3>
                <p>Est. Time: ${recipe.estimatedTime}</p>
                <p class="last-cooked-date">Last Cooked: ${lastCookedFormatted}</p>
            `;
            card.addEventListener('click', () => showDetailView(recipe.id));
            recipeListContainer.appendChild(card);
        });
    }

     function renderRecipeDetail(recipeId) {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) {
            console.error(`Recipe with ID ${recipeId} not found.`);
            // Optionally show an error message in the UI
            return;
        }

        currentRecipeId = recipeId; // Store the currently viewed recipe ID

        const recipeCookedInfo = cookedData[recipe.id] || { lastCooked: null, lastMarkedAsCooked: null };

        // Create ingredients list items
        const ingredientsList = recipe.ingredients.map(ing => `<li>${ing}</li>`).join('');
        // Create instructions list items
        const instructionsList = recipe.instructions.map(step => `<li>${step}</li>`).join('');

        recipeContent.innerHTML = `
            <h2>${recipe.name}</h2>
            <p><strong>Estimated Cooking Time:</strong> ${recipe.estimatedTime}</p>
            <h3>Ingredients</h3>
            <ul>${ingredientsList}</ul>
            <h3>Instructions</h3>
            <ol>${instructionsList}</ol>
        `;

        // Update the "Last Cooked" and "Last Marked" display in the detail view
        updateDetailCookedDates(recipeId);
    }

    function updateDetailCookedDates(recipeId) {
         const recipeCookedInfo = cookedData[recipeId] || { lastCooked: null, lastMarkedAsCooked: null };
         detailLastCookedDateEl.textContent = formatDate(recipeCookedInfo.lastCooked);
         detailLastMarkedDateEl.textContent = formatDate(recipeCookedInfo.lastMarkedAsCooked, true); // Show time for marking
    }


    // --- View Switching ---

    function showListView() {
        recipeDetailView.classList.remove('active');
        recipeListView.classList.add('active');
        currentRecipeId = null; // Clear current recipe ID
        releaseWakeLock(); // Release wake lock when going back to list
        renderRecipeList(); // Re-render list to show potentially updated dates
    }

    function showDetailView(recipeId) {
        renderRecipeDetail(recipeId);
        recipeListView.classList.remove('active');
        recipeDetailView.classList.add('active');
        // Reset wake lock button state visually when showing a new detail view
        updateWakeLockButton(false);
    }

    // --- Event Handlers ---

    backButton.addEventListener('click', showListView);

    cookedButton.addEventListener('click', () => {
        if (!currentRecipeId) return;

        const now = new Date().toISOString();
        if (!cookedData[currentRecipeId]) {
             cookedData[currentRecipeId] = {}; // Initialize if somehow missing
        }
        cookedData[currentRecipeId].lastCooked = now;
        cookedData[currentRecipeId].lastMarkedAsCooked = now;

        saveCookedData();
        updateDetailCookedDates(currentRecipeId); // Update display immediately
        // Optionally add some visual feedback (e.g., button changes text briefly)
        console.log(`Marked '${recipes.find(r=>r.id === currentRecipeId)?.name}' as cooked on ${formatDate(now, true)}`);
         // Note: The list view will update its date next time it's rendered (via showListView)
    });

    // --- Screen Wake Lock ---

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                updateWakeLockButton(true);
                console.log('Screen Wake Lock activated.');

                // Re-request wake lock if visibility changes (e.g., tab switch)
                 document.addEventListener('visibilitychange', handleVisibilityChange);
                 wakeLock.addEventListener('release', () => {
                    console.log('Screen Wake Lock released.');
                    // No need to manually set wakeLock = null here as the release event handles it
                    // Only update the button if the lock was not released manually by the user clicking the button
                    if (wakeLock) { // Check if it was released programmatically (e.g., tab hidden)
                         updateWakeLockButton(false);
                         wakeLock = null; // Ensure it's null if released by browser
                    }
                 });

            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
                alert(`Could not activate Screen Wake Lock: ${err.message}`);
                updateWakeLockButton(false);
            }
        } else {
            alert('Screen Wake Lock API not supported in this browser.');
            updateWakeLockButton(false);
        }
    }

    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release()
                .then(() => {
                    wakeLock = null;
                    updateWakeLockButton(false);
                     document.removeEventListener('visibilitychange', handleVisibilityChange);
                     console.log('Screen Wake Lock released manually.');
                })
                .catch((err) => {
                     console.error(`Error releasing wake lock: ${err.name}, ${err.message}`);
                     // Even if release fails, update UI assuming it's inactive
                     wakeLock = null;
                     updateWakeLockButton(false);
                     document.removeEventListener('visibilitychange', handleVisibilityChange);
                });

        }
    }

     async function handleVisibilityChange() {
        if (wakeLock !== null && document.visibilityState === 'visible') {
             try {
                // Try to re-acquire the lock when tab becomes visible again
                await requestWakeLock();
             } catch (error) {
                console.error("Failed to re-acquire wake lock on visibility change:", error);
                // State should already be updated by requestWakeLock's error handling
             }
        }
    }


    function updateWakeLockButton(isActive) {
        if (isActive) {
            wakeLockButton.textContent = 'Keep Screen Awake: ON';
            wakeLockButton.classList.add('active');
            wakeLockButton.title = 'Screen will stay on. Click to disable.';
        } else {
            wakeLockButton.textContent = 'Keep Screen Awake: OFF';
            wakeLockButton.classList.remove('active');
             wakeLockButton.title = 'Prevent screen from sleeping. Click to enable.';
        }
    }

    wakeLockButton.addEventListener('click', () => {
        if (wakeLock === null) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }
    });


    // --- Utility Functions ---

    function formatDate(dateString, includeTime = false) {
        if (!dateString) return "Never";
        try {
            const date = new Date(dateString);
             if (isNaN(date)) return "Invalid Date"; // Check if the date object is valid

            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };
            if (includeTime) {
                options.hour = 'numeric';
                options.minute = '2-digit';
                options.hour12 = true; // Use AM/PM
            }
            return date.toLocaleDateString(undefined, options);
        } catch (error) {
            console.error("Error formatting date:", dateString, error);
            return "Error";
        }
    }

    // --- Initialization ---
    loadRecipes(); // Start the application by loading recipes
});