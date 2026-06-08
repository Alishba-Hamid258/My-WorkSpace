/**
 * University Portfolio Controller
 * Handle interactive UI behaviors, file readers, dynamic feed rendering
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadForm = document.getElementById('project-upload-form');
    const projectFeed = document.getElementById('project-feed');
    const projectCountVal = document.getElementById('project-count-val');
    const projectCategorySelect = document.getElementById('project-category');
    const projectFileInput = document.getElementById('project-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fileLabelText = document.getElementById('file-label-text');
    const fileHelpTextNode = document.getElementById('file-help-text-node');
    const filterTabBtns = document.querySelectorAll('.filter-tab-btn');

    // Portfolio State
    let projectsList = [];
    let currentFilter = 'all';
    
    // Public Database Configurations (kvdb.io Bucket)
    const PUBLIC_DB_URL = 'https://kvdb.io/MNXoZJc9nphZp7xZ6n8492/alishba_portfolio_shared_projects';
    let publicProjectsList = [];

    // Category mapping for accepted file types and labels
    const categoryConfig = {
        video: {
            accept: 'video/*',
            helpText: 'Supported: MP4, WebM, OGG (Max 100MB)',
            label: 'Upload Video File'
        },
        presentation: {
            accept: '.ppt,.pptx,.pdf,.key',
            helpText: 'Supported: PPT, PPTX, PDF, Keynote (Max 100MB)',
            label: 'Upload Slide Deck (PPT/PDF)'
        },
        image: {
            accept: 'image/*',
            helpText: 'Supported: PNG, JPG, JPEG, GIF, WebP (Max 50MB)',
            label: 'Upload Project Graphic'
        },
        document: {
            accept: '.pdf,.doc,.docx,.txt,.csv,.rtf',
            helpText: 'Supported: PDF, DOC, DOCX, TXT, CSV (Max 50MB)',
            label: 'Upload Report / PDF File'
        }
    };

    // Initialize preloaded projects (Starts empty for user uploads)
    function initPreloadedProjects() {
        projectsList = [];
        renderFeed();
    }

    // Format file sizes into human readable text
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Dynamic configuration update on category change
    function updateFileInputConfig() {
        const category = projectCategorySelect.value;
        const config = categoryConfig[category];
        
        if (config) {
            projectFileInput.setAttribute('accept', config.accept);
            fileLabelText.textContent = config.label;
            fileHelpTextNode.textContent = config.helpText;
            
            // Clear current input name display on switch
            fileNameDisplay.textContent = 'Choose ' + category.charAt(0).toUpperCase() + category.slice(1) + ' file...';
            projectFileInput.value = ''; // Reset input value
        }
    }

    // Handle File Input selection display
    projectFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            fileNameDisplay.textContent = file.name + ' (' + formatBytes(file.size) + ')';
        } else {
            const category = projectCategorySelect.value;
            fileNameDisplay.textContent = 'Choose ' + category.charAt(0).toUpperCase() + category.slice(1) + ' file...';
        }
    });

    // Handle Category Select change event
    projectCategorySelect.addEventListener('change', updateFileInputConfig);

    // Filter Tabs click handler
    filterTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterTabBtns.forEach(tab => tab.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderFeed();
        });
    });

    // Form submission
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = document.getElementById('project-title').value.trim();
        const category = projectCategorySelect.value;
        const description = document.getElementById('project-description').value.trim();
        const file = projectFileInput.files[0];
        const link = document.getElementById('project-link').value.trim();
        const sharePublicly = document.getElementById('project-share-public') ? document.getElementById('project-share-public').checked : false;

        if (!file && !link) {
            alert('Please select a file to upload OR paste a public share link!');
            return;
        }

        function saveLocalAndRender(finalFileUrl, finalFileName, finalFileSize, finalFileData) {
            const newProject = {
                id: 'uploaded-' + Date.now(),
                title: title,
                type: category,
                categoryName: getCategoryName(category),
                description: description,
                fileName: finalFileName,
                fileSize: finalFileSize,
                fileUrl: finalFileUrl,
                fileData: finalFileData // Store File Blob in IndexedDB!
            };

            // Add to state and save to DB
            projectsList.unshift(newProject);
            saveProjectToDB(newProject);
            
            // Reset form & inputs
            uploadForm.reset();
            fileNameDisplay.textContent = 'Choose file...';
            updateFileInputConfig();
            
            // Rerender feed
            renderFeed();
            
            // Scroll to new project
            const targetCard = document.getElementById(newProject.id);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return newProject;
        }

        if (sharePublicly) {
            if (file) {
                uploadFileToPublic(file, (publicUrl) => {
                    const savedLocal = saveLocalAndRender(URL.createObjectURL(file), file.name, formatBytes(file.size), file);
                    publishToPublicBucket(savedLocal.title, savedLocal.type, savedLocal.description, publicUrl, file.name, formatBytes(file.size));
                }, (err) => {
                    alert('Failed to upload file to the public server: ' + err.message + '. Saving locally only.');
                    saveLocalAndRender(URL.createObjectURL(file), file.name, formatBytes(file.size), file);
                });
            } else {
                const savedLocal = saveLocalAndRender(link, 'Public Link', 'External URL', null);
                publishToPublicBucket(savedLocal.title, savedLocal.type, savedLocal.description, link, 'Public Link', 'External URL');
            }
        } else {
            if (file) {
                saveLocalAndRender(URL.createObjectURL(file), file.name, formatBytes(file.size), file);
            } else {
                saveLocalAndRender(link, 'Public Link', 'External URL', null);
            }
        }
    });

    // Translate category values to presentable names
    function getCategoryName(category) {
        switch (category) {
            case 'video': return 'Video Project';
            case 'presentation': return 'Presentation / Slide Deck';
            case 'image': return 'Graphic / Design Media';
            case 'document': return 'Academic Report / Document';
            default: return 'Project Workspace Resource';
        }
    }

    // -------------------------------------------------------------
    // IndexedDB Database Helpers for Local Persistent Storage
    // -------------------------------------------------------------
    const dbName = "AcademicPortfolioDB";
    const storeName = "projects";
    let db = null;

    function openDatabase(callback) {
        const request = indexedDB.open(dbName, 1);
        
        request.onupgradeneeded = function(e) {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(storeName)) {
                database.createObjectStore(storeName, { keyPath: "id" });
            }
        };

        request.onsuccess = function(e) {
            db = e.target.result;
            if (callback) callback();
        };

        request.onerror = function(e) {
            console.error("IndexedDB error:", e);
            if (window.location.protocol === 'file:') {
                alert("Browser Security Notice: You opened this site directly from local files (file:///...). Browsers block local databases on file:// schemes for security. To save your uploaded files permanently, please use the live GitHub website link or start a local server (http://localhost:8000)!");
            }
            if (callback) callback();
        };
    }

    function saveProjectToDB(project) {
        if (!db) return;
        const dbCopy = { ...project };
        if (dbCopy.fileUrl && dbCopy.fileUrl.startsWith('blob:')) {
            delete dbCopy.fileUrl; // Regenerate on load
        }
        
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put(dbCopy);
    }

    function deleteProjectFromDB(projectId) {
        if (!db) return;
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.delete(projectId);
    }

    // Helper to upload files directly to tmpfiles.org public hosting (48-hour expiration)
    function uploadFileToPublic(file, successCallback, errorCallback) {
        const overlay = document.getElementById('upload-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('expire', '172800'); // 48 hours in seconds (172800)

        fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => {
            if (!res.ok) {
                throw new Error('Upload failed with status ' + res.status);
            }
            return res.json();
        })
        .then(resData => {
            if (resData.status === 'success' && resData.data && resData.data.url) {
                const rawUrl = resData.data.url;
                // Convert to direct download/embed link (replace view URL with direct download URL)
                const directUrl = rawUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
                successCallback(directUrl);
            } else {
                throw new Error(resData.message || 'Unknown response format');
            }
        })
        .catch(err => {
            console.error('Upload error:', err);
            errorCallback(err);
        })
        .finally(() => {
            if (overlay) {
                overlay.style.display = 'none';
            }
        });
    }

    // Helper to publish a project configuration to the public database bucket (kvdb.io)
    function publishToPublicBucket(title, type, description, fileUrl, fileName, fileSize) {
        const publicItem = {
            id: 'public-' + Date.now(),
            title: title,
            type: type,
            categoryName: 'Shared ' + getCategoryName(type),
            description: description,
            fileName: fileName || 'Public Link',
            fileSize: fileSize || 'External Link',
            fileUrl: fileUrl
        };

        // Prevent duplicates in public shared feed
        if (publicProjectsList.some(p => p.title === publicItem.title && p.fileUrl === publicItem.fileUrl)) {
            alert('This project is already shared publicly!');
            return;
        }

        publicProjectsList.unshift(publicItem);

        fetch(PUBLIC_DB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(publicProjectsList)
        })
        .then(res => {
            if (res.ok) {
                alert('Successfully published to the Public Shared tab! (Note: Uploaded files will be stored publicly for 48 hours)');
                const publicTabBtn = document.querySelector('.filter-tab-btn[data-filter="public"]');
                if (publicTabBtn) {
                    publicTabBtn.click();
                }
            } else {
                alert('Failed to publish to the public database.');
            }
        })
        .catch(err => {
            console.error("Error publishing project:", err);
            alert('Database connection error.');
        });
    }

    // Fetch shared projects from kvdb database
    function fetchPublicProjects() {
        fetch(PUBLIC_DB_URL)
            .then(res => {
                if (res.status === 404) {
                    return [];
                }
                return res.json();
            })
            .then(data => {
                publicProjectsList = data || [];
                console.log("Fetched shared projects:", publicProjectsList.length);
                if (currentFilter === 'public') {
                    renderFeed();
                }
            })
            .catch(err => {
                console.error("Error fetching shared projects:", err);
            });
    }

    // Publish project to the public database
    window.makeProjectPublic = function(projectId) {
        const project = projectsList.find(p => p.id === projectId);
        if (!project) return;

        if (confirm('Do you want to publish this project to the Public Shared tab for everyone to see?')) {
            if (project.fileData && (project.fileData instanceof Blob || project.fileData instanceof File)) {
                // If it is a local file, upload it to the public server first
                uploadFileToPublic(project.fileData, (publicUrl) => {
                    // Update project with public URL so it persists
                    project.fileUrl = publicUrl;
                    saveProjectToDB(project);
                    renderFeed();

                    publishToPublicBucket(project.title, project.type, project.description, publicUrl, project.fileName, project.fileSize);
                }, (err) => {
                    alert('Failed to upload file to the public server: ' + err.message);
                });
            } else if (project.fileUrl && !project.fileUrl.startsWith('blob:')) {
                // If it is already a public link
                publishToPublicBucket(project.title, project.type, project.description, project.fileUrl, project.fileName, project.fileSize);
            } else {
                alert('Cannot share this project: No file data or URL found.');
            }
        }
    };

    function loadProjectsFromDB() {
        if (!db) {
            initPreloadedProjects();
            return;
        }
        
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = function(e) {
            const saved = e.target.result || [];
            if (saved.length === 0) {
                initPreloadedProjects();
            } else {
                projectsList = saved.map(p => {
                    if (p.fileData && (p.fileData instanceof Blob || p.fileData instanceof File)) {
                        try {
                            p.fileUrl = URL.createObjectURL(p.fileData);
                        } catch (err) {
                            console.error("Error creating Object URL for project:", p.id, err);
                            p.fileUrl = '';
                        }
                    } else if (p.fileUrl) {
                        // Keep publicUrl/external URL as is
                    } else {
                        p.fileUrl = '';
                    }
                    return p;
                });
                projectsList.sort((a, b) => b.id.localeCompare(a.id));
                renderFeed();
            }
        };
        
        request.onerror = function() {
            initPreloadedProjects();
        };
    }

    // Toggle logic for CapCut vs AI video player tabs
    window.switchVideoTab = function(tabName, projectId) {
        const cardNode = document.getElementById(projectId);
        if (!cardNode) return;

        const buttons = cardNode.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const panels = cardNode.querySelectorAll('.video-panel');
        panels.forEach(panel => {
            if (panel.getAttribute('id') === `${projectId}-${tabName}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    };

    // Delete project from feed logic
    window.deleteProject = function(projectId) {
        // If it is a public file hosted on the database, delete from database
        if (projectId.startsWith('public-')) {
            if (confirm('Are you sure you want to delete this project from the Public Shared tab? (This will remove it for everyone).')) {
                const pubIndex = publicProjectsList.findIndex(p => p.id === projectId);
                if (pubIndex !== -1) {
                    publicProjectsList.splice(pubIndex, 1);
                    
                    fetch(PUBLIC_DB_URL, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(publicProjectsList)
                    })
                    .then(res => {
                        if (res.ok) {
                            alert('Project deleted from Public Shared tab.');
                            renderFeed();
                        } else {
                            alert('Failed to delete project from database.');
                        }
                    })
                    .catch(err => {
                        console.error("Error deleting public project:", err);
                        alert('Database error.');
                    });
                }
            }
            return;
        }

        const index = projectsList.findIndex(p => p.id === projectId);
        if (index === -1) return;
        const project = projectsList[index];

        if (confirm('Are you sure you want to delete this project?')) {
            if (project.fileUrl && project.fileUrl.startsWith('blob:')) {
                URL.revokeObjectURL(project.fileUrl);
            }
            deleteProjectFromDB(projectId);
            projectsList.splice(index, 1);
            renderFeed();
        }
    };

    // Helper to get embeddable iframe URL for YouTube or Google Drive share links
    function getEmbedUrl(url) {
        if (!url) return '';
        
        // YouTube Watch Link
        const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const ytMatch = url.match(ytReg);
        if (ytMatch && ytMatch[2].length === 11) {
            return `https://www.youtube.com/embed/${ytMatch[2]}`;
        }
        
        // YouTube Shorts Link
        if (url.includes('youtube.com/shorts/')) {
            const parts = url.split('/shorts/');
            if (parts[1]) {
                const shortsId = parts[1].split('?')[0];
                return `https://www.youtube.com/embed/${shortsId}`;
            }
        }

        // Google Drive Share Link
        if (url.includes('drive.google.com')) {
            const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch && driveMatch[1]) {
                return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
            }
        }
        
        return url;
    }

    // Render feed HTML based on project array state
    function renderFeed() {
        projectFeed.innerHTML = '';

        // Filter list
        let filteredList = projectsList;
        if (currentFilter === 'public') {
            filteredList = publicProjectsList;
        } else if (currentFilter !== 'all') {
            filteredList = projectsList.filter(p => p.type === currentFilter);
        }

        projectCountVal.textContent = filteredList.length;

        if (filteredList.length === 0) {
            let emptyMsg = 'Your workspace is empty. Use the sidebar form on the left to select a project file (Video, PPT, Image, or Document), enter a description, and publish it dynamically here!';
            if (currentFilter === 'public') {
                emptyMsg = `No public shared projects yet. Click the share icon on your local cards to publish them to this tab!`;
            } else if (currentFilter !== 'all') {
                emptyMsg = `No projects found under the "${getCategoryName(currentFilter)}" tab. Use the form on the left to upload one!`;
            }
            projectFeed.innerHTML = `
                <div class="empty-state-card glass-card">
                    <i class="fa-solid fa-folder-open empty-state-icon"></i>
                    <h3>No Projects Found</h3>
                    <p>${emptyMsg}</p>
                </div>
            `;
            return;
        }

        filteredList.forEach(project => {
            const card = document.createElement('article');
            card.className = 'glass-card project-card';
            card.id = project.id;

            let previewHtml = '';

            // Generate HTML based on Project Type
            if (project.type === 'video-comparison') {
                previewHtml = `
                    <div class="project-preview-container video-comparison-container">
                        <div class="video-tabs-nav">
                            <button class="tab-btn active" data-tab="capcut" onclick="switchVideoTab('capcut', '${project.id}')">
                                <i class="fa-solid fa-scissors"></i> CapCut (Manual)
                            </button>
                            <button class="tab-btn" data-tab="ai" onclick="switchVideoTab('ai', '${project.id}')">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> AI Generated
                            </button>
                        </div>
                        <div class="video-tab-panels">
                            <div class="video-panel active" id="${project.id}-capcut">
                                <div class="video-placeholder-graphic">
                                    <i class="fa-solid fa-video-slash"></i>
                                    <div>
                                        <h5 class="doc-meta-title">Manual CapCut Video Player</h5>
                                        <p class="doc-meta-size">Timeline cuts, custom transitions, speed ramps.</p>
                                    </div>
                                </div>
                            </div>
                            <div class="video-panel" id="${project.id}-ai">
                                <div class="video-placeholder-graphic" style="background: radial-gradient(circle, #24143a 0%, #06050e 100%)">
                                    <i class="fa-solid fa-sparkles" style="color: var(--accent-pink); text-shadow: 0 0 20px rgba(255, 0, 127, 0.6)"></i>
                                    <div>
                                        <h5 class="doc-meta-title">AI Video Generator Player</h5>
                                        <p class="doc-meta-size">Text-to-video diffusion models, AI transitions.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Comparison Dashboard Matrix -->
                    <div class="comparison-matrix-card">
                        <h4>Lab Comparison Metrics</h4>
                        <div class="matrix-grid">
                            ${project.metrics.map(metric => `
                                <div class="matrix-row">
                                    <span class="row-label">${metric.name}</span>
                                    <div class="metric-column">
                                        <div class="metric-header">
                                            <span>CapCut</span>
                                            <span>${metric.capcut}%</span>
                                        </div>
                                        <div class="metric-bar-container">
                                            <div class="metric-bar capcut" style="width: ${metric.capcut}%"></div>
                                        </div>
                                    </div>
                                    <div class="metric-column">
                                        <div class="metric-header">
                                            <span>AI Video</span>
                                            <span>${metric.ai}%</span>
                                        </div>
                                        <div class="metric-bar-container">
                                            <div class="metric-bar ai" style="width: ${metric.ai}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else if (project.type === 'video') {
                const embedUrl = getEmbedUrl(project.fileUrl);
                if (embedUrl.includes('youtube.com/embed') || embedUrl.includes('drive.google.com/file/d')) {
                    previewHtml = `
                        <div class="project-preview-container">
                            <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" allowfullscreen title="${project.title}"></iframe>
                        </div>
                    `;
                } else {
                    previewHtml = `
                        <div class="project-preview-container">
                            <video controls src="${project.fileUrl}"></video>
                        </div>
                    `;
                }
            } else if (project.type === 'image') {
                previewHtml = `
                    <div class="project-preview-container">
                        <img src="${project.fileUrl}" class="project-image-preview" alt="${project.title}">
                    </div>
                `;
            } else if (project.type === 'presentation') {
                const embedUrl = getEmbedUrl(project.fileUrl);
                // If PDF presentation or Google Drive link, render live in iframe
                if (embedUrl.includes('drive.google.com') || (project.fileName && project.fileName.toLowerCase().endsWith('.pdf')) || embedUrl.toLowerCase().endsWith('.pdf')) {
                    previewHtml = `
                        <div class="project-preview-container">
                            <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" title="${project.title}"></iframe>
                        </div>
                    `;
                } else {
                    previewHtml = `
                        <div class="project-preview-container">
                            <div class="document-preview-box" style="background: radial-gradient(circle, #221a2e 0%, #06050e 100%)">
                                <i class="fa-solid fa-file-powerpoint" style="color: var(--accent-pink); text-shadow: 0 0 20px rgba(255, 0, 127, 0.5)"></i>
                                <div>
                                    <h5 class="doc-meta-title">${project.fileName}</h5>
                                    <p class="doc-meta-size">Interactive Slides Presentation (${project.fileSize || 'Local File'})</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } else {
                const embedUrl = getEmbedUrl(project.fileUrl);
                // PDF, TXT or Google Drive render in iframe, binary files show download card
                if (embedUrl.includes('drive.google.com') || (project.fileName && (project.fileName.toLowerCase().endsWith('.pdf') || project.fileName.toLowerCase().endsWith('.txt'))) || embedUrl.toLowerCase().endsWith('.pdf') || embedUrl.toLowerCase().endsWith('.txt')) {
                    previewHtml = `
                        <div class="project-preview-container">
                            <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" title="${project.title}"></iframe>
                        </div>
                    `;
                } else {
                    previewHtml = `
                        <div class="project-preview-container">
                            <div class="document-preview-box">
                                <i class="fa-solid fa-file-pdf"></i>
                                <div>
                                    <h5 class="doc-meta-title">${project.fileName}</h5>
                                    <p class="doc-meta-size">Workspace Resource (${project.fileSize || 'Local File'})</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            const showShareBtn = project.id.startsWith('uploaded-');
            const shareBtnHtml = showShareBtn ? `
                <button class="share-btn" onclick="makeProjectPublic('${project.id}')" title="Publish to Public Shared Tab">
                    <i class="fa-solid fa-share-nodes"></i>
                </button>
            ` : '';

            // Put card together
            card.innerHTML = `
                <div class="project-card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="project-meta-left">
                        <div class="badge-group" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                            <span class="badge">${project.categoryName}</span>
                            ${project.fileSize ? `<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.05);">${project.fileSize}</span>` : ''}
                        </div>
                        <h2 class="project-title">${project.title}</h2>
                    </div>
                    <div style="display: flex; align-items: center;">
                        ${shareBtnHtml}
                        <button class="delete-btn" onclick="deleteProject('${project.id}')" title="Delete Project">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Media Preview -->
                ${previewHtml}

                <!-- Description & Learnings Panel -->
                <div class="project-details-section">
                    <h4><i class="fa-solid fa-circle-info"></i> Details & Project Reflections</h4>
                    <div class="project-details-content">${project.description}</div>
                </div>

                <!-- Footer Downloads -->
                <div class="project-card-actions">
                    <a href="${project.fileUrl}" download="${project.fileName}" class="download-link" id="download-${project.id}">
                        <i class="fa-solid fa-circle-arrow-down"></i>
                        <span>Download Project Files (${project.fileName} - ${project.fileSize || 'Local File'})</span>
                    </a>
                </div>
            `;

            projectFeed.appendChild(card);
        });
    }

    // Initialize forms and load projects from databases
    updateFileInputConfig();
    openDatabase(() => {
        loadProjectsFromDB();
    });
    fetchPublicProjects();
});
