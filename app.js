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

    // Portfolio State
    let projectsList = [];

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

    // Form submission
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = document.getElementById('project-title').value.trim();
        const category = projectCategorySelect.value;
        const description = document.getElementById('project-description').value.trim();
        const file = projectFileInput.files[0];

        if (!file) {
            alert('Please select a file to upload!');
            return;
        }

        // Create Object URL from local file upload
        const objectUrl = URL.createObjectURL(file);
        
        const newProject = {
            id: 'uploaded-' + Date.now(),
            title: title,
            type: category,
            categoryName: getCategoryName(category),
            description: description,
            fileName: file.name,
            fileSize: formatBytes(file.size),
            fileUrl: objectUrl
        };

        // Add to the front of the list
        projectsList.unshift(newProject);
        
        // Reset form & inputs
        uploadForm.reset();
        fileNameDisplay.textContent = 'Choose file...';
        updateFileInputConfig();
        
        // Rerender feed
        renderFeed();
        
        // Scroll to new project with smooth behavior
        const targetCard = document.getElementById(newProject.id);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // Toggle logic for CapCut vs AI video player tabs
    window.switchVideoTab = function(tabName, projectId) {
        const cardNode = document.getElementById(projectId);
        if (!cardNode) return;

        // Toggle buttons
        const buttons = cardNode.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Toggle panels
        const panels = cardNode.querySelectorAll('.video-panel');
        panels.forEach(panel => {
            if (panel.getAttribute('id') === `${projectId}-${tabName}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    };

    // Render feed HTML based on project array state
    function renderFeed() {
        projectFeed.innerHTML = '';
        projectCountVal.textContent = projectsList.length;

        if (projectsList.length === 0) {
            projectFeed.innerHTML = `
                <div class="empty-state-card glass-card">
                    <i class="fa-solid fa-folder-open empty-state-icon"></i>
                    <h3>No Projects Uploaded Yet</h3>
                    <p>Your workspace is empty. Use the sidebar form on the left to select a project file (Video, PPT, Image, or Document), enter a description, and publish it dynamically here!</p>
                </div>
            `;
            return;
        }

        projectsList.forEach(project => {
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
                previewHtml = `
                    <div class="project-preview-container">
                        <video controls src="${project.fileUrl}"></video>
                    </div>
                `;
            } else if (project.type === 'image') {
                previewHtml = `
                    <div class="project-preview-container">
                        <img src="${project.fileUrl}" class="project-image-preview" alt="${project.title}">
                    </div>
                `;
            } else if (project.type === 'presentation') {
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
            } else {
                // Documents / default
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

            // Put card together
            card.innerHTML = `
                <div class="project-card-header">
                    <div class="project-meta-left">
                        <div class="badge-group" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                            <span class="badge">${project.categoryName}</span>
                            ${project.fileSize ? `<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.05);">${project.fileSize}</span>` : ''}
                        </div>
                        <h2 class="project-title">${project.title}</h2>
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

    // Initialize forms and preload projects
    updateFileInputConfig();
    initPreloadedProjects();
});
