    // Add Todo JS


    console.log('base.js file parsed.');

    // Simple debounce function (keep this)
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }




    // Helper function to get a cookie by name
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    };

    function logout() {
        // Get all cookies
        const cookies = document.cookie.split(";");

        // Iterate through all cookies and delete each one
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            // Set the cookie's expiry date to a past date to delete it
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }

        // Redirect to the login page
        window.location.href = '/auth/login-page';
    };


    // Function to fetch and display description suggestions
    async function fetchDescriptionSuggestions(title, descriptionTextAreaId, aiSuggestedInputId, alternativesContainerId) {
        const descriptionTextArea = document.getElementById(descriptionTextAreaId);
        const aiSuggestedInput = document.getElementById(aiSuggestedInputId);
        const alternativesContainer = document.getElementById(alternativesContainerId);

        // Clear previous suggestions
        descriptionTextArea.placeholder = '';
        aiSuggestedInput.value = '';
        alternativesContainer.innerHTML = '';

        try {
            const token = getCookie('access_token');
            if (!token) {
                console.warn('Authentication token not found. Cannot fetch suggestions.');
                return;
            }

            const response = await fetch('/todos/suggest-description', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: title })
            });

            if (response.ok) {
                const data = await response.json();
                const suggestion = data.suggestion;

                if (suggestion) {
                    // Apply the first suggestion as placeholder
                    descriptionTextArea.placeholder = suggestion;
                    aiSuggestedInput.value = suggestion; // Store for later use
                } else {
                    descriptionTextArea.placeholder = 'No description provided by AI.';
                    aiSuggestedInput.value = '';
                }
            } else {
                const errorData = await response.json();
                console.error('Error fetching suggestions:', errorData.detail);
            }
        } catch (error) {
            console.error('Network error fetching suggestions:', error);
        }
    }

    // Attach event listeners for suggestion fetching and application
    function setupDescriptionSuggestion(titleInputId, descriptionTextAreaId, aiSuggestedInputId, alternativesContainerId) {
        const titleInput = document.getElementById(titleInputId);
        const descriptionTextArea = document.getElementById(descriptionTextAreaId);
        const aiSuggestedInput = document.getElementById(aiSuggestedInputId);
        const alternativesContainer = document.getElementById(alternativesContainerId);
        let form = null;


        if (titleInput && descriptionTextArea && aiSuggestedInput && alternativesContainer) {
            form = descriptionTextArea.closest('form');
        }

        if (titleInput && descriptionTextArea && aiSuggestedInput && alternativesContainer && form) {
            titleInput.addEventListener('input', debounce(function(event) {
                if (descriptionTextArea.value.trim() === '') {
                    fetchDescriptionSuggestions(event.target.value, descriptionTextAreaId, aiSuggestedInputId, alternativesContainerId);
                } else {
                    descriptionTextArea.placeholder = '';
                    aiSuggestedInput.value = '';
                    alternativesContainer.innerHTML = '';
                }
            }, 800));

            // Apply suggestion when description textarea loses focus AND its empty
            // THIS IS THE KEY PART: Make sure the value is filled in on blur
            descriptionTextArea.addEventListener('blur', function() {
                // Only fill if current value is empty AND AI suggestion exists in hidden input
                if (this.value.trim() === '' && aiSuggestedInput.value.trim() !== '') {
                    this.value = aiSuggestedInput.value; // Directly put AI value into description text area
                    this.style.color = ''; // Reset color if any custom style was applied
                    // No need to set placeholder here, as value is now set
                }
            });

            // Clear placeholder when user starts typing (this prevents showing placeholder if value is already AI filled)
            descriptionTextArea.addEventListener('focus', function() {
                // If the value is the AI suggested one (from blur event), and user focuses, clear it.
                // This allows them to type over it cleanly.
                if (this.value.trim() === aiSuggestedInput.value.trim() && this.value.trim() !== '') {
                    this.value = ''; // Clear value to allow fresh typing
                    this.placeholder = aiSuggestedInput.value; // Restore placeholder for visual cue
                } else if (this.value.trim() === '') {
                    this.placeholder = ''; // If truly empty, clear placeholder
                }
            });

            // If user types, we consider their input as dominant.
            // This input listener should always clear any AI-related state once user starts typing.
            descriptionTextArea.addEventListener('input', function() {
                // If user types, we consider their input as dominant, so clear hidden AI suggestion
                aiSuggestedInput.value = '';
                alternativesContainer.innerHTML = '';
            });

            // Apply suggestion from placeholder on Enter key press if current value is empty
            descriptionTextArea.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') { // Check for Enter key first
                    // If textarea is empty, and AI suggestion exists in hidden input
                    if (this.value.trim() === '' && aiSuggestedInput.value.trim() !== '') {
                        event.preventDefault(); // Prevent new line
                        this.value = aiSuggestedInput.value; // Set the value
                        this.style.color = ''; // Reset color
                        // aiSuggestedInput.value = this.value; // Already set by the above line, not strictly needed
                        alternativesContainer.innerHTML = ''; // Clear alternatives
                        this.blur(); // Remove focus
                    } else if (this.value.trim() !== '') {
                        // If user typed something, allow default Enter behavior (new line)
                        // No need to preventDefault unless you want to prevent all new lines in textarea on enter
                        // For now, if content is present, let Enter work as normal (add new line)
                    }
                }
            });

            // Intercept form submission to use AI suggestion if user hasn't typed anything
            // This is a fallback in case 'blur' didn't happen or required validation
            // triggered before blur.
            form.addEventListener('submit', function(event) {
                // Only fill if current value is empty AND AI suggestion exists in hidden input
                if (descriptionTextArea.value.trim() === '' && aiSuggestedInput.value.trim() !== '') {
                    descriptionTextArea.value = aiSuggestedInput.value;
                }
                // No need to preventDefault or stopPropagation here unless default form submission
                // behavior is undesirable *after* value is set.
                // Browser's required validation will now pass if value is set.
            });
        } else {
            console.warn(`Could not set up AI suggestion for ${titleInputId}: One or more elements not found.`);
            console.warn({ titleInput, descriptionTextArea, aiSuggestedInput, alternativesContainer, form });
        }
    }



    document.addEventListener('DOMContentLoaded', function() {
        const todoForm = document.getElementById('todoForm');
        if (todoForm) {
            todoForm.addEventListener('submit', async function(event) {
                event.preventDefault();
                console.log('Form submit intercepted!');

                const form = event.target;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                const descriptionTextArea = document.getElementById('todoDescription');
                const aiSuggestedInput = document.getElementById('aiSuggestedDescription');
                console.log(descriptionTextArea.value)
                console.log(aiSuggestedInput.value)
                if (!descriptionTextArea.value && aiSuggestedInput.value) {
                    console.log('Applying AI suggestion from hidden input.');
                    descriptionTextArea.value = aiSuggestedInput.value;
                }

                const payload = {
                    title: data.title,
                    description: descriptionTextArea.value,
                    priority: parseInt(data.priority),
                    complete: false
                };

                try {
                    const response = await fetch('/todos/todo', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getCookie('access_token')}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        form.reset(); // Clear the form
                    } else {
                        // Handle error
                        const errorData = await response.json();
                        alert(`Error: ${errorData.detail}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred. Please try again.');
                }
            });
        }

        // Edit Todo JS
        const editTodoForm = document.getElementById('editTodoForm');
        if (editTodoForm) {
            editTodoForm.addEventListener('submit', async function(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                var url = window.location.pathname;
                const todoId = url.substring(url.lastIndexOf('/') + 1);

                const payload = {
                    title: data.title,
                    description: data.description,
                    priority: parseInt(data.priority),
                    complete: data.complete === "on"
                };

                try {
                    const token = getCookie('access_token');
                    console.log(token)
                    if (!token) {
                        throw new Error('Authentication token not found');
                    }

                    console.log(`${todoId}`)

                    const response = await fetch(`/todos/todo/${todoId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        window.location.href = '/todos/todo-page'; // Redirect to the todo page
                    } else {
                        // Handle error
                        const errorData = await response.json();
                        alert(`Error: ${errorData.detail}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred. Please try again.');
                }
            });

            document.getElementById('deleteButton').addEventListener('click', async function() {
                var url = window.location.pathname;
                const todoId = url.substring(url.lastIndexOf('/') + 1);

                try {
                    const token = getCookie('access_token');
                    if (!token) {
                        throw new Error('Authentication token not found');
                    }

                    const response = await fetch(`/todos/todo/${todoId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        // Handle success
                        window.location.href = '/todos/todo-page'; // Redirect to the todo page
                    } else {
                        // Handle error
                        const errorData = await response.json();
                        alert(`Error: ${errorData.detail}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred. Please try again.');
                }
            });


        }

        // Login JS
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async function(event) {
                event.preventDefault();

                const form = event.target;
                const formData = new FormData(form);

                const payload = new URLSearchParams();
                for (const [key, value] of formData.entries()) {
                    payload.append(key, value);
                }

                try {
                    const response = await fetch('/auth/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: payload.toString()
                    });

                    if (response.ok) {
                        // Handle success (e.g., redirect to dashboard)
                        const data = await response.json();
                        // Delete any cookies available
                        logout();
                        // Save token to cookie
                        document.cookie = `access_token=${data.access_token}; path=/`;
                        window.location.href = '/todos/todo-page'; // Change this to your desired redirect page
                    } else {
                        // Handle error
                        const errorData = await response.json();
                        alert(`Error: ${errorData.detail}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred. Please try again.');
                }
            });
        }

        // Register JS
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', async function(event) {
                event.preventDefault();

                const form = event.target;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                if (data.password !== data.password2) {
                    alert("Passwords do not match");
                    return;
                }

                const payload = {
                    email: data.email,
                    username: data.username,
                    first_name: data.firstname,
                    last_name: data.lastname,
                    role: data.role,
                    phone_number: data.phone_number,
                    password: data.password
                };

                try {
                    const response = await fetch('/auth', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        window.location.href = '/auth/login-page';
                    } else {
                        // Handle error
                        const errorData = await response.json();
                        alert(`Error: ${errorData.message}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('An error occurred. Please try again.');
                }
            });
        }



        // Initialize for Add Todo page
        setupDescriptionSuggestion('todoTitle', 'todoDescription', 'aiSuggestedDescription', 'suggestionAlternatives');

        console.log('Description suggestion setup complete.'); // <-- Add this log
    });