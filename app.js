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
    const PUBLIC_DB_URL = 'https://kvdb.io/J2qexFiJjh2NaWkGpH8rb9/alishba_portfolio_shared_projects';

    // User Owner Token to securely delete/manage their own shared projects
    let ownerToken = localStorage.getItem('portfolio_owner_token');
    if (!ownerToken) {
        ownerToken = 'owner-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
        localStorage.setItem('portfolio_owner_token', ownerToken);
    }

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

        if (!file && !link) {
            alert('Please select a file to upload OR paste a public share link!');
            return;
        }

        const handleProjectAddition = (fileUrl, fileName, fileSize) => {
            const newProject = {
                id: 'public-' + Date.now(),
                title: title,
                type: category,
                categoryName: getCategoryName(category),
                description: description,
                fileName: fileName,
                fileSize: fileSize,
                fileUrl: fileUrl,
                owner: ownerToken
            };

            projectsList.unshift(newProject);
            
            // Sync to KVdb
            saveProjectsToPublicDB(() => {
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
            });
        };

        if (file) {
            uploadFileToPublic(file, (publicUrl) => {
                handleProjectAddition(publicUrl, file.name, formatBytes(file.size));
            }, (err) => {
                alert('Failed to upload file to the public server: ' + err.message);
            });
        } else {
            handleProjectAddition(link, 'Public Link', 'External URL');
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

    // Helper to upload files directly to tmpfiles.org public hosting (48-hour expiration)
    function uploadFileToPublic(file, successCallback, errorCallback) {
        const overlay = document.getElementById('upload-overlay');
        const progressBarContainer = document.getElementById('upload-progress-bar-container');
        const progressBar = document.getElementById('upload-progress-bar');
        const progressTitle = overlay ? overlay.querySelector('h3') : null;
        
        if (overlay) {
            overlay.style.display = 'flex';
            if (progressBarContainer) progressBarContainer.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';
            if (progressTitle) progressTitle.textContent = "Uploading to Public Servers (0%)";
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://tmpfiles.org/api/v1/upload');

        // Track upload progress in real-time
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (progressBar) progressBar.style.width = percentComplete + '%';
                if (progressTitle) progressTitle.textContent = "Uploading to Public Servers (" + percentComplete + "%)";
            }
        };

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const resData = JSON.parse(xhr.responseText);
                    if (resData.status === 'success' && resData.data && resData.data.url) {
                        const rawUrl = resData.data.url;
                        // Convert to direct download/embed link (replace view URL with direct download URL)
                        const directUrl = rawUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
                        successCallback(directUrl);
                    } else {
                        errorCallback(new Error(resData.message || 'Unknown response format'));
                    }
                } catch (err) {
                    errorCallback(new Error('Failed to parse response: ' + err.message));
                }
            } else {
                errorCallback(new Error('Upload failed with status ' + xhr.status));
            }
            hideOverlay();
        };

        xhr.onerror = function() {
            errorCallback(new Error('Network error during upload.'));
            hideOverlay();
        };

        function hideOverlay() {
            if (overlay) overlay.style.display = 'none';
            if (progressBarContainer) progressBarContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (progressTitle) progressTitle.textContent = "Uploading to Public Servers";
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('expire', '172800'); // 48 hours in seconds (172800)

        xhr.send(formData);
    }

    // Save projects to public database bucket (kvdb.io)
    function saveProjectsToPublicDB(callback) {
        fetch(PUBLIC_DB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectsList)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error('HTTP status ' + res.status);
            }
            console.log("Synced projects list to public DB.");
            if (callback) callback();
        })
        .catch(err => {
            console.error("Error saving projects to database:", err);
            alert('Failed to save project to public database. Please verify that your bucket has been activated by checking your email inbox for alishbahamid17@gmail.com and clicking the verification link from KVdb.io!');
        });
    }

    // Load projects from public database bucket
    function loadProjectsFromPublicDB() {
        fetch(PUBLIC_DB_URL)
            .then(res => {
                if (res.status === 404) {
                    return [];
                }
                return res.json();
            })
            .then(data => {
                projectsList = data || [];
                console.log("Fetched projects:", projectsList.length);
                renderFeed();
            })
            .catch(err => {
                console.error("Error fetching projects:", err);
                projectsList = [];
                renderFeed();
            });
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
        const index = projectsList.findIndex(p => p.id === projectId);
        if (index === -1) return;
        const project = projectsList[index];

        // Verify owner permissions
        if (project.owner !== ownerToken) {
            alert('Permission Denied: You are not the owner of this project and cannot delete it.');
            return;
        }

        if (confirm('Are you sure you want to delete this project? This will remove it for everyone.')) {
            if (project.fileUrl && project.fileUrl.startsWith('blob:')) {
                URL.revokeObjectURL(project.fileUrl);
            }
            projectsList.splice(index, 1);
            saveProjectsToPublicDB(() => {
                renderFeed();
            });
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
        if (currentFilter !== 'all') {
            filteredList = projectsList.filter(p => p.type === currentFilter);
        }

        projectCountVal.textContent = filteredList.length;

        if (filteredList.length === 0) {
            let emptyMsg = 'Your workspace is empty. Use the sidebar form on the left to select a project file (Video, PPT, Image, or Document), enter a description, and publish it dynamically here!';
            if (currentFilter !== 'all') {
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

            // Public cards can only be deleted by their owner
            const showDeleteBtn = (project.owner === ownerToken);
            const deleteBtnHtml = showDeleteBtn ? `
                <button class="delete-btn" onclick="deleteProject('${project.id}')" title="Delete Project">
                    <i class="fa-solid fa-trash-can"></i>
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
                        ${deleteBtnHtml}
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
    loadProjectsFromPublicDB();
});
