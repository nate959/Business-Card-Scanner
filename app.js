document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const imageInput = document.getElementById('imageInput');
    
    const sections = {
        upload: document.getElementById('uploadSection'),
        loading: document.getElementById('loadingSection'),
        editor: document.getElementById('editorSection')
    };
    
    const imagePreview = document.getElementById('imagePreview');
    const loadingText = document.getElementById('loadingText');
    const progressBar = document.getElementById('progressBar');
    
    const form = document.getElementById('extractionForm');
    const inputs = {
        name: document.getElementById('nameInput'),
        email: document.getElementById('emailInput'),
        phone: document.getElementById('phoneInput'),
        company: document.getElementById('companyInput')
    };
    
    const retakeBtn = document.getElementById('retakeBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettings = document.getElementById('closeSettings');
    const settingsModal = document.getElementById('settingsModal');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    
    const jotformApiKeyEl = document.getElementById('jotformApiKey');
    const jotformIdEl = document.getElementById('jotformId');

    // App State
    let currentImageBlob = null;
    let extractedDataCache = null; // Storing raw text just in case
    
    // Initialize Settings from LocalStorage (Hardcoded for immediate use)
    const loadSettings = () => {
        const apiKey = '47c0eb1c6f312cc0cd4e9c6be1c5f3b8';
        const formId = '260853094120047';
        
        jotformApiKeyEl.value = apiKey;
        jotformIdEl.value = formId;
        
        // Force save to local storage so standard functions pick it up instantly
        localStorage.setItem('jotformApiKey', apiKey);
        localStorage.setItem('jotformId', formId);
    };
    
    loadSettings();

    // Event Listeners for UI
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    
    saveSettingsBtn.addEventListener('click', () => {
        localStorage.setItem('jotformApiKey', jotformApiKeyEl.value.trim());
        localStorage.setItem('jotformId', jotformIdEl.value.trim());
        settingsModal.classList.add('hidden');
        showToast('Settings saved successfully', 'success');
    });

    // Drag and Drop Logic
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary-color)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImage(e.dataTransfer.files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0]);
        }
    });
    
    retakeBtn.addEventListener('click', () => {
        imageInput.value = '';
        currentImageBlob = null;
        showSection('upload');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitToJotform();
    });

    // Helper functions
    const showSection = (sectionName) => {
        Object.values(sections).forEach(sec => sec.classList.add('hidden'));
        sections[sectionName].classList.remove('hidden');
    };

    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = type === 'success' ? `<i class="fas fa-check-circle"></i> ${message}` : `<i class="fas fa-exclamation-circle"></i> ${message}`;
        
        const container = document.getElementById('toastContainer');
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // Main Processing Flow
    const processImage = (file) => {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file.', 'error');
            return;
        }

        currentImageBlob = file;
        
        // Setup Image Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            runOCR(e.target.result);
        };
        reader.readAsDataURL(file);
    };

    const runOCR = async (imageSrc) => {
        showSection('loading');
        progressBar.style.width = '0%';
        loadingText.textContent = 'Initializing Tesseract AI...';

        try {
            // Use Tesseract CDN instance directly
            const worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressBar.style.width = `${Math.round(m.progress * 100)}%`;
                        loadingText.textContent = `Scanning Card... ${Math.round(m.progress * 100)}%`;
                    }
                }
            });

            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            
            loadingText.textContent = 'Analyzing text layout...';
            const { data: { text } } = await worker.recognize(imageSrc);
            
            extractedDataCache = text;
            await worker.terminate();
            
            parseExtractedText(text);
            showSection('editor');
            showToast('Scan complete!', 'success');

        } catch (error) {
            console.error('OCR Error:', error);
            showSection('upload');
            showToast('Text extraction failed. Try another picture.', 'error');
        }
    };

    const parseExtractedText = (text) => {
        console.log('Raw OCR Output:', text);
        
        // Clean text
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const fullText = text.replace(/\n/g, ' ');

        // Regex definitions
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i;
        const phoneRegex = /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/i;
        
        // Extract Email
        const emailMatch = fullText.match(emailRegex);
        inputs.email.value = emailMatch ? emailMatch[1] : '';

        // Extract Phone (look through lines instead of full text to avoid joining numbers randomly)
        let phoneMatch = null;
        for (let line of lines) {
            let match = line.match(phoneRegex);
            if (match) {
                // simple cleanup of non-digits
                let cleanNumber = match[0].replace(/[^\d+]/g, '');
                // Format slightly if length is ok
                if (cleanNumber.length >= 10) {
                     phoneMatch = match[0];
                     break;
                }
            }
        }
        inputs.phone.value = phoneMatch ? phoneMatch.trim() : '';

        // Name heuristics (usually first or second line, looking for Capitalized words)
        // This is a naive heuristic: take first line that looks like a name and doesn't contain email/phone
        let nameMatch = '';
        for (let line of lines) {
            if (!line.match(emailRegex) && !line.match(phoneRegex) && line.split(' ').length <= 4 && line.match(/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/)) {
                nameMatch = line;
                break;
            }
        }
        
        // Fallback for name: just use the first non-empty line
        if (!nameMatch && lines.length > 0) {
            let firstRow = lines[0];
            if (!firstRow.match(emailRegex) && !firstRow.match(phoneRegex) && firstRow.length < 30) {
                nameMatch = firstRow;
            }
        }
        inputs.name.value = nameMatch;

        // Company heuristics: longest line with "Inc", "LLC", "Ltd", or generic capitalized words
        let companyMatch = '';
        for (let line of lines) {
            if (line.match(/(Inc\.|LLC|Corp\.|Ltd\.|Company)/i) && !line.match(emailRegex)) {
                companyMatch = line;
                break;
            }
        }
        inputs.company.value = companyMatch;
    };

    const submitToJotform = async () => {
        const apiKey = localStorage.getItem('jotformApiKey');
        const formId = localStorage.getItem('jotformId');

        if (!apiKey || !formId) {
            settingsModal.classList.remove('hidden');
            showToast('Please configure Jotform API settings first.', 'error');
            return;
        }

        const btnOriginalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        try {
            const questionsRes = await fetch(`https://api.jotform.com/form/${formId}/questions?apiKey=${apiKey}`);
            const questionsData = await questionsRes.json();
            
            if (questionsData.responseCode !== 200) {
                throw new Error('Failed to retrieve form layout. Check ID & Key.');
            }

            const questions = questionsData.content;
            
            // Map our inputs to the form questions based on generic names
            const submissionData = new URLSearchParams();
            
            // Helper to find a question ID based on its text/name
            const findQid = (typeMatches, nameMatches) => {
                for (const qid in questions) {
                    const q = questions[qid];
                    if (typeMatches.includes(q.type) || nameMatches.some(n => (q.name || '').toLowerCase().includes(n) || (q.text || '').toLowerCase().includes(n))) {
                        return qid;
                    }
                }
                return null;
            };

            // Full Name Mapping
            const nameQid = findQid(['control_fullname'], ['name', 'fullname', 'first']);
            if (nameQid) {
                const parts = inputs.name.value.trim().split(' ');
                const first = parts[0] || '';
                const last = parts.slice(1).join(' ') || '';
                if (first) submissionData.append(`submission[${nameQid}][first]`, first);
                if (last) submissionData.append(`submission[${nameQid}][last]`, last);
                // Fallback if it's a standard text field
                if (!questions[nameQid].type.includes('fullname')) {
                    submissionData.append(`submission[${nameQid}]`, inputs.name.value);
                }
            }

            // Email Mapping
            const emailQid = findQid(['control_email'], ['email']);
            if (emailQid && inputs.email.value) {
                submissionData.append(`submission[${emailQid}]`, inputs.email.value);
            }

            // Phone Mapping
            const phoneQid = findQid(['control_phone'], ['phone', 'mobile']);
            if (phoneQid && inputs.phone.value) {
                submissionData.append(`submission[${phoneQid}]`, inputs.phone.value);
            }

            // Company Mapping
            const companyQid = findQid([], ['company', 'business', 'organization']);
            if (companyQid && inputs.company.value) {
                submissionData.append(`submission[${companyQid}]`, inputs.company.value);
            }

            // Also append the raw text as a 'notes' field if found
            const notesQid = findQid(['control_textarea'], ['notes', 'comments', 'raw', 'text']);
            if (notesQid && extractedDataCache) {
                 submissionData.append(`submission[${notesQid}]`, `Raw OCR Text:\n${extractedDataCache}`);
            }

            // Actually submit
            const submitRes = await fetch(`https://api.jotform.com/form/${formId}/submissions?apiKey=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: submissionData.toString()
            });

            const submitResult = await submitRes.json();
            
            if (submitResult.responseCode === 200) {
                showToast('Successfully submitted to Jotform!', 'success');
                // Auto reset after 3 seconds
                setTimeout(() => {
                    imageInput.value = '';
                    currentImageBlob = null;
                    showSection('upload');
                }, 3000);
            } else {
                throw new Error(submitResult.message || 'Submission failed');
            }

        } catch (error) {
            console.error('Submission Error:', error);
            showToast(error.message || 'Failed to submit form', 'error');
        } finally {
            submitBtn.innerHTML = 'Submit to Jotform <i class="fas fa-paper-plane ml-2"></i>';
            submitBtn.disabled = false;
        }
    };
});
