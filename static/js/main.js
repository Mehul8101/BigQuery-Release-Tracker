// BigQuery Release Pulse - Frontend Controller
// Logic for feed fetching, filtering, text extraction, theme toggling, and Tweet composer operations.

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        updates: [],
        filteredUpdates: [],
        selectedItem: null,
        activeFilter: 'all',
        searchQuery: '',
        isFetching: false,
        theme: 'dark'
    };

    // DOM Elements
    const elements = {
        body: document.body,
        refreshBtn: document.getElementById('refresh-btn'),
        refreshSpinner: document.getElementById('refresh-spinner'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        lastSyncTime: document.getElementById('last-sync-time'),
        themeToggle: document.getElementById('theme-toggle'),
        themeDarkIcon: document.querySelector('.theme-dark-icon'),
        themeLightIcon: document.querySelector('.theme-light-icon'),
        searchInput: document.getElementById('search-input'),
        searchClear: document.getElementById('search-clear'),
        filterChips: document.querySelectorAll('.filter-chip'),
        visibleCount: document.getElementById('visible-count'),
        feedSkeleton: document.getElementById('feed-skeleton'),
        feedContainer: document.getElementById('feed-container'),
        emptyState: document.getElementById('empty-state'),
        
        // Composer Elements
        composerEmptyState: document.getElementById('composer-empty-state'),
        composerFormPanel: document.getElementById('composer-form-panel'),
        composerItemType: document.getElementById('composer-item-type'),
        composerItemDate: document.getElementById('composer-item-date'),
        composerStatusBadge: document.getElementById('composer-status-badge'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charCounter: document.getElementById('char-counter'),
        progressCircle: document.querySelector('.progress-ring-circle'),
        charLimitWarning: document.getElementById('char-limit-warning'),
        tweetIntentBtn: document.getElementById('tweet-intent-btn'),
        copyTweetBtn: document.getElementById('copy-tweet-btn'),
        deselectBtn: document.getElementById('deselect-composer-btn'),
        composerBackdrop: document.getElementById('composer-backdrop'),
        mobileCloseBtn: document.getElementById('mobile-close-btn'),
        hashtagChips: document.querySelectorAll('.hashtag-chip'),
        
        // Toast Notification
        toast: document.getElementById('toast-notification'),
        toastMessage: document.getElementById('toast-message')
    };

    // Progress Ring settings
    const circleRadius = 14;
    const circleCircumference = 2 * Math.PI * circleRadius;
    if (elements.progressCircle) {
        elements.progressCircle.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
        elements.progressCircle.style.strokeDashoffset = circleCircumference;
    }

    // --- Core Logic Functions ---

    // Fetch release notes from backend API
    async function fetchReleaseNotes(forceRefresh = false) {
        if (state.isFetching) return;
        
        setLoadingState(true);
        try {
            const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.status === 'success' || data.status === 'warning') {
                state.updates = data.updates || [];
                
                // Format the sync time
                if (data.last_fetched) {
                    const syncDate = new Date(data.last_fetched);
                    elements.lastSyncTime.textContent = `Synced: ${syncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                } else {
                    elements.lastSyncTime.textContent = 'Synced: Just now';
                }
                
                if (data.status === 'warning') {
                    showToast(`Loaded with warning: ${data.error}`, 4000);
                }
            } else {
                throw new Error(data.error || 'Failed to fetch release notes.');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast('Failed to load release notes. Showing offline mode.');
            elements.lastSyncTime.textContent = 'Sync failed';
        } finally {
            setLoadingState(false);
            filterAndRenderFeed();
        }
    }

    // Set UI loading state
    function setLoadingState(isLoading) {
        state.isFetching = isLoading;
        if (isLoading) {
            elements.refreshSpinner.style.display = 'inline-block';
            elements.refreshBtn.disabled = true;
            elements.feedSkeleton.style.display = 'block';
            elements.feedContainer.style.display = 'none';
            elements.emptyState.style.display = 'none';
            
            // Adjust sync status badge
            const indicator = document.querySelector('.status-indicator');
            indicator.className = 'status-indicator syncing';
        } else {
            elements.refreshSpinner.style.display = 'none';
            elements.refreshBtn.disabled = false;
            elements.feedSkeleton.style.display = 'none';
            
            const indicator = document.querySelector('.status-indicator');
            indicator.className = 'status-indicator online';
        }
    }

    // Filter updates and render them
    function filterAndRenderFeed() {
        state.filteredUpdates = state.updates.filter(item => {
            // Type filtering
            const matchesType = state.activeFilter === 'all' || item.type.toLowerCase() === state.activeFilter.toLowerCase();
            
            // Text search filtering
            const query = state.searchQuery.toLowerCase().trim();
            const matchesSearch = !query || 
                item.type.toLowerCase().includes(query) || 
                item.date.toLowerCase().includes(query) || 
                item.content_text.toLowerCase().includes(query);
                
            return matchesType && matchesSearch;
        });

        elements.visibleCount.textContent = `${state.filteredUpdates.length} Update${state.filteredUpdates.length !== 1 ? 's' : ''}`;
        
        if (state.filteredUpdates.length === 0) {
            elements.feedContainer.style.display = 'none';
            elements.emptyState.style.display = 'flex';
        } else {
            elements.feedContainer.style.display = 'block';
            elements.emptyState.style.display = 'none';
            renderFeed();
        }
    }

    // Highlight matching query text inside HTML content (ignoring tags)
    function highlightText(html, query) {
        if (!query) return html;
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(<[^>]+>)|(${escapedQuery})`, 'gi');
        return html.replace(regex, (match, p1, p2) => {
            if (p1) return p1; // Return HTML tag untouched
            return `<mark>${p2}</mark>`;
        });
    }

    // Group items by date and inject HTML
    function renderFeed() {
        elements.feedContainer.innerHTML = '';
        
        // Group filtered items by date
        const groups = {};
        state.filteredUpdates.forEach(item => {
            if (!groups[item.date]) {
                groups[item.date] = [];
            }
            groups[item.date].push(item);
        });

        // Loop through each group and create HTML structures
        for (const date in groups) {
            const dateGroupDiv = document.createElement('div');
            dateGroupDiv.className = 'date-group';
            
            const dateHeading = document.createElement('div');
            dateHeading.className = 'date-heading';
            dateHeading.textContent = date;
            dateGroupDiv.appendChild(dateHeading);

            groups[date].forEach(item => {
                const card = document.createElement('div');
                card.className = `update-card type-${item.type.toLowerCase()}`;
                card.dataset.id = item.id;
                
                if (state.selectedItem && state.selectedItem.id === item.id) {
                    card.classList.add('selected');
                }

                // Custom badge selection
                let badgeClass = 'badge-update';
                if (['feature', 'changed', 'issue', 'announcement', 'deprecated'].includes(item.type.toLowerCase())) {
                    badgeClass = `badge-${item.type.toLowerCase()}`;
                }

                card.innerHTML = `
                    <div class="card-top">
                        <span class="badge ${badgeClass}">${item.type}</span>
                        <span class="card-date">${item.date}</span>
                    </div>
                    <div class="card-content">
                        ${highlightText(item.content_html, state.searchQuery)}
                    </div>
                    <div class="card-footer">
                        <div class="select-wrapper">
                            <div class="checkbox-custom">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <span>Draft Tweet</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-card copy-card-btn" title="Copy release notes content to clipboard">
                                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-2 4h.01M9 16h.01"></path>
                                </svg>
                                <span>Copy</span>
                            </button>
                            <a href="${item.link}" target="_blank" class="btn btn-card" title="View official Google release notes documentation">
                                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                </svg>
                            </a>
                        </div>
                    </div>
                `;

                // Card selection click (excludes button clicks)
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.card-actions') || e.target.closest('a')) {
                        return; // Ignore selection if clicking actions
                    }
                    selectItem(item);
                });

                // Copy single card text content handler
                const copyBtn = card.querySelector('.copy-card-btn');
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${item.date} [${item.type}]: ${item.content_text}`)
                        .then(() => showToast('Update copied to clipboard!'))
                        .catch(() => showToast('Failed to copy.'));
                });

                dateGroupDiv.appendChild(card);
            });

            elements.feedContainer.appendChild(dateGroupDiv);
        }
    }

    // Handle Item Selection for Tweet Composer
    function selectItem(item) {
        // Toggle off if clicking the same item that's already selected
        if (state.selectedItem && state.selectedItem.id === item.id) {
            deselectItem();
            return;
        }

        state.selectedItem = item;

        // Update selected state class on DOM cards
        document.querySelectorAll('.update-card').forEach(card => {
            if (card.dataset.id === item.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Render Composer Details
        elements.composerEmptyState.style.display = 'none';
        elements.composerFormPanel.style.display = 'flex';
        elements.composerStatusBadge.style.display = 'inline-flex';
        
        elements.composerItemDate.textContent = item.date;
        elements.composerItemType.textContent = item.type;
        
        // Remove existing badge class and add current
        elements.composerItemType.className = 'badge';
        let badgeClass = 'badge-update';
        if (['feature', 'changed', 'issue', 'announcement', 'deprecated'].includes(item.type.toLowerCase())) {
            badgeClass = `badge-${item.type.toLowerCase()}`;
        }
        elements.composerItemType.classList.add(badgeClass);

        // Pre-fill textarea with custom layout
        elements.tweetTextarea.value = generateDefaultTweet(item);
        
        // Update character details
        updateCharCounter();
        updateHashtagChipsState();
        
        document.body.classList.add('composer-open');

        // Smooth scroll to composer on desktop or active view
        if (window.innerWidth > 960) {
            elements.composerFormPanel.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Deselect current update
    function deselectItem() {
        state.selectedItem = null;
        
        // Clear DOM cards class list
        document.querySelectorAll('.update-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        elements.composerEmptyState.style.display = 'flex';
        elements.composerFormPanel.style.display = 'none';
        elements.composerStatusBadge.style.display = 'none';
        document.body.classList.remove('composer-open');
    }

    // Auto-generate standard tweet layout within 280 characters
    function generateDefaultTweet(item) {
        const typeEmoji = {
            'feature': '🚀',
            'changed': '🔄',
            'issue': '⚠️',
            'announcement': '📢',
            'deprecated': '🛑'
        };
        
        const emoji = typeEmoji[item.type.toLowerCase()] || '📢';
        const typeTag = `[${item.type.toUpperCase()}]`;
        const intro = `${emoji} BigQuery Release ${typeTag} (${item.date}):\n\n`;
        
        // Build post links and tags
        const linkStr = `\n\nDetails: ${item.link}`;
        const hashtags = `\n#BigQuery #GCP`;
        
        // Standard Twitter limits are 280. Calculate max length of main content
        const maxContentLen = 280 - (intro.length + linkStr.length + hashtags.length) - 5;
        
        let cleanedBody = item.content_text;
        
        // Remove links in body if they repeat the final link, or parse neatly
        // Simple sentence truncation:
        if (cleanedBody.length > maxContentLen) {
            cleanedBody = cleanedBody.slice(0, maxContentLen - 3) + '...';
        }
        
        return `${intro}${cleanedBody}${linkStr}${hashtags}`;
    }

    // Update the live character count and ring
    function updateCharCounter() {
        const text = elements.tweetTextarea.value;
        const currentLength = text.length;
        const limit = 280;
        const remaining = limit - currentLength;

        elements.charCounter.textContent = remaining;

        // Progress ring coloring & stroke offsets
        if (elements.progressCircle) {
            const percentage = Math.min(currentLength / limit, 1);
            const offset = circleCircumference - (percentage * circleCircumference);
            elements.progressCircle.style.strokeDashoffset = offset;
            
            // Color thresholds
            if (remaining < 0) {
                elements.progressCircle.style.stroke = 'var(--color-issue)';
                elements.charCounter.className = 'char-count error';
                elements.charLimitWarning.style.display = 'flex';
            } else if (remaining <= 20) {
                elements.progressCircle.style.stroke = 'var(--color-changed)';
                elements.charCounter.className = 'char-count warning';
                elements.charLimitWarning.style.display = 'none';
            } else {
                elements.progressCircle.style.stroke = 'var(--primary)';
                elements.charCounter.className = 'char-count';
                elements.charLimitWarning.style.display = 'none';
            }
        }
    }

    // Sync state of quick hashtags chips based on current textarea text
    function updateHashtagChipsState() {
        const text = elements.tweetTextarea.value;
        elements.hashtagChips.forEach(chip => {
            const tag = chip.dataset.tag;
            // Exact word boundary check for tag
            const regex = new RegExp(`\\b${tag}\\b`, 'i');
            if (regex.test(text)) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // Toast alerts helper
    function showToast(message, duration = 3000) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.add('show');
        
        // Clear any ongoing timers to prevent overlaps
        if (state.toastTimer) {
            clearTimeout(state.toastTimer);
        }
        
        state.toastTimer = setTimeout(() => {
            elements.toast.classList.remove('show');
        }, duration);
    }

    // --- Theme Management ---
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        state.theme = savedTheme;
        
        if (savedTheme === 'light') {
            elements.body.classList.remove('dark-theme');
            elements.themeDarkIcon.style.display = 'none';
            elements.themeLightIcon.style.display = 'block';
        } else {
            elements.body.classList.add('dark-theme');
            elements.themeDarkIcon.style.display = 'block';
            elements.themeLightIcon.style.display = 'none';
        }
    }

    function toggleTheme() {
        if (state.theme === 'dark') {
            state.theme = 'light';
            elements.body.classList.remove('dark-theme');
            elements.themeDarkIcon.style.display = 'none';
            elements.themeLightIcon.style.display = 'block';
        } else {
            state.theme = 'dark';
            elements.body.classList.add('dark-theme');
            elements.themeDarkIcon.style.display = 'block';
            elements.themeLightIcon.style.display = 'none';
        }
        localStorage.setItem('theme', state.theme);
    }


    // --- Event Listeners Setup ---

    // Sync button event
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Theme toggle click
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Filter Chips tabs selection
    elements.filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeFilter = chip.dataset.type;
            filterAndRenderFeed();
        });
    });

    // Search input typing with dynamic clear button
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery.length > 0) {
            elements.searchClear.style.display = 'block';
        } else {
            elements.searchClear.style.display = 'none';
        }
        
        // Search filtering
        filterAndRenderFeed();
    });

    // Clear Search Input Action
    elements.searchClear.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClear.style.display = 'none';
        filterAndRenderFeed();
        elements.searchInput.focus();
    });

    // Tweet composer input tracking
    elements.tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
        updateHashtagChipsState();
    });

    // Quick hashtag toggle chip events
    elements.hashtagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            let currentText = elements.tweetTextarea.value;
            
            // Check if tag is currently inside the composer text
            const regex = new RegExp(`\\b${tag}\\b`, 'i');
            if (regex.test(currentText)) {
                // Remove the tag (and excess space around it)
                currentText = currentText.replace(new RegExp(`\\s*${tag}`, 'g'), '');
            } else {
                // Append the tag to the text area
                currentText = currentText.trim() + ` ${tag}`;
            }
            
            elements.tweetTextarea.value = currentText;
            updateCharCounter();
            updateHashtagChipsState();
        });
    });

    // Tweet button share web intent triggering
    elements.tweetIntentBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        // Web Intent URL
        const tweetUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
        window.open(tweetUrl, '_blank', 'width=550,height=420,menubar=no,toolbar=no,scrollbars=yes');
    });

    // Copy tweet content button
    elements.copyTweetBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        navigator.clipboard.writeText(text)
            .then(() => showToast('Tweet text copied! ready to share.'))
            .catch(() => showToast('Failed to copy.'));
    });

    // Deselect composer click
    elements.deselectBtn.addEventListener('click', deselectItem);

    // Export current filtered updates to CSV
    function exportToCSV() {
        if (state.filteredUpdates.length === 0) {
            showToast('No updates to export.');
            return;
        }

        // CSV content start with UTF-8 BOM to prevent spreadsheet software encoding issues
        let csvContent = 'Date,Type,Link,Content\n';

        state.filteredUpdates.forEach(item => {
            // Helper to escape values and wrap in double quotes
            const date = `"${item.date.replace(/"/g, '""')}"`;
            const type = `"${item.type.replace(/"/g, '""')}"`;
            const link = `"${item.link.replace(/"/g, '""')}"`;
            const content = `"${item.content_text.replace(/"/g, '""')}"`;

            csvContent += `${date},${type},${link},${content}\n`;
        });

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Filename: bigquery_releases_YYYY-MM-DD.csv
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_releases_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('CSV export downloaded successfully!');
    }

    // CSV button click listener
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Close mobile composer on backdrop click
    if (elements.composerBackdrop) {
        elements.composerBackdrop.addEventListener('click', deselectItem);
    }

    // Close mobile composer on close button click
    if (elements.mobileCloseBtn) {
        elements.mobileCloseBtn.addEventListener('click', deselectItem);
    }


    // --- Startup ---
    initializeTheme();
    fetchReleaseNotes(false); // fetch on load (can pull from server cache if not stale)
});
