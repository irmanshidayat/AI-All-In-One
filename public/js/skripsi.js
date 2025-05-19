// Skripsi Feature Javascript
// Deklarasi variabel global
let currentType = null;
let openrouterApiKey = null;
let openrouterApiUrl = null;
let loadingModalInstance = null;

// Format AI response text
function formatAIResponse(text) {
    if (!text) return '';
    return text
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*\*/g, '<em>$1</em>');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Skripsi.js loaded successfully');
    
    // Mendapatkan API key dan URL dari meta tag
    openrouterApiKey = document.querySelector('meta[name="openrouter-key"]').getAttribute('content');
    openrouterApiUrl = document.querySelector('meta[name="openrouter-url"]').getAttribute('content');

    // Global variables
    let currentTitle = '';
    let currentContent = '';
    
    // Show loading spinner
    function showLoading() {
      try {
        // Store active element to restore focus later
        const activeElement = document.activeElement;
        if (activeElement) {
          activeElement.blur();
        }
        
        // Periksa apakah Bootstrap tersedia
        if (typeof bootstrap !== 'undefined') {
          const loadingElement = document.getElementById('loadingModal');
          
          // Ensure the modal is properly initialized for accessibility
          if (loadingElement) {
            // Remove any tabindex attributes that might cause focus issues
            const focusableElements = loadingElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            focusableElements.forEach(el => {
              el.setAttribute('tabindex', '-1');
            });
          }
          
          const loadingModal = new bootstrap.Modal(loadingElement, {
            backdrop: 'static',
            keyboard: false
          });
          
          loadingModal.show();
          loadingModalInstance = loadingModal;
          return loadingModal;
        } else {
          console.warn("Bootstrap tidak tersedia, menampilkan pesan loading alternatif");
          const loadingElement = document.getElementById('loadingModal');
          if (loadingElement) {
            loadingElement.classList.add('d-block');
            loadingElement.style.display = 'block';
            loadingElement.style.background = 'rgba(0,0,0,0.5)';
            loadingElement.style.position = 'fixed';
            loadingElement.style.top = '0';
            loadingElement.style.left = '0';
            loadingElement.style.width = '100%';
            loadingElement.style.height = '100%';
            loadingElement.style.zIndex = '9999';
            return { hide: function() { 
              loadingElement.classList.remove('d-block');
              loadingElement.style.display = 'none';
            }};
          }
          return { hide: function() { console.log('Loading selesai'); }};
        }
      } catch (error) {
        console.error('Error displaying loading modal:', error);
        return { hide: function() { console.log('Loading selesai'); }};
      }
    }
    
    // Hide loading spinner
    function hideLoading(modal) {
      try {
        // First try to hide the modal using its own hide function
        if (modal && typeof modal.hide === 'function') {
          modal.hide();
        }
        
        // If we have a global modal instance, hide it as well (for safety)
        if (loadingModalInstance && typeof loadingModalInstance.hide === 'function') {
          loadingModalInstance.hide();
          loadingModalInstance = null;
        }
        
        // As a fallback, also try to manually hide the modal element by its ID
        const loadingElement = document.getElementById('loadingModal');
        if (loadingElement) {
          try {
            // Try to hide with Bootstrap if available
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
              const bsInstance = bootstrap.Modal.getInstance(loadingElement);
              if (bsInstance) bsInstance.hide();
            }
          } catch (err) {
            console.warn('Error hiding modal with bootstrap:', err);
          }
          
          // Manual DOM cleanup as final fallback
          loadingElement.classList.remove('show', 'd-block');
          loadingElement.setAttribute('aria-hidden', 'true');
          loadingElement.style.display = 'none';
          
          // Remove modal backdrop if it exists
          const backdrop = document.querySelector('.modal-backdrop');
          if (backdrop) {
            backdrop.classList.remove('show');
            backdrop.parentNode.removeChild(backdrop);
          }
          
          // Re-enable body scrolling
          document.body.classList.remove('modal-open');
          document.body.style.removeProperty('overflow');
          document.body.style.removeProperty('padding-right');
        }
      } catch (error) {
        console.error('Error hiding loading modal:', error);
        // Last resort emergency cleanup
        document.querySelectorAll('.modal, .modal-backdrop').forEach(el => {
          el.parentNode.removeChild(el);
        });
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      }
    }
    
    // Event listener untuk form judul
    const generateTitleForm = document.getElementById('generateTitleForm');
    if (generateTitleForm) {
        generateTitleForm.addEventListener('submit', handleGenerateTitleSubmit);
    }

    // Event listener untuk form perbaikan judul
    const improveTitleForm = document.getElementById('improveTitleForm');
    if (improveTitleForm) {
        improveTitleForm.addEventListener('submit', handleImproveTitleSubmit);
    }

    // Event listeners untuk navigasi elemen skripsi di BAB I
    setupElementNavigation();

    // Event listener untuk tombol submit BAB I
    const bab1SubmitBtn = document.getElementById('bab1-submit-btn');
    if (bab1SubmitBtn) {
        bab1SubmitBtn.addEventListener('click', handleBab1Submit);
    }

    // Event listener untuk tombol paste BAB I
    const bab1PasteBtn = document.getElementById('bab1-paste-btn');
    if (bab1PasteBtn) {
        bab1PasteBtn.addEventListener('click', handleBab1Paste);
    }

    // Event listener untuk tombol copy hasil BAB I
    const bab1CopyBtn = document.getElementById('bab1-copy-btn');
    if (bab1CopyBtn) {
        bab1CopyBtn.addEventListener('click', function() {
            const resultContent = document.querySelector('#bab1Result .result-content');
            copyToClipboard(resultContent.textContent);
            showToast('Konten berhasil disalin ke clipboard!');
        });
    }

    // Event listener untuk tombol save BAB I
    const bab1SaveBtn = document.getElementById('bab1-save-btn');
    if (bab1SaveBtn) {
        bab1SaveBtn.addEventListener('click', function() {
            const title = document.getElementById('bab1-title').value.trim();
            const resultContent = document.querySelector('#bab1Result .result-content').textContent.trim();
            if (!title) {
                showToast('Judul skripsi tidak boleh kosong', 'warning');
                return;
            }
            if (!resultContent) {
                showToast('Tidak ada konten yang dapat disimpan', 'warning');
                return;
            }
            saveContent(title, currentType || 'bab1', resultContent);
        });
    }

    // Generate Title Form Submit
    const generateTitleFormOld = document.getElementById('generateTitleForm');
    if (generateTitleFormOld) {
        generateTitleFormOld.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Generate title form submitted');
            
            const topic = document.getElementById('topic').value.trim();
            if (!topic) {
                alert('Mohon masukkan topik skripsi');
                return;
            }
            
            const loadingModal = showLoading();
            
            try {
                const response = await fetch('/dashboard/skripsi/api/generate-title', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ topic })
                });
                
                console.log('Response status:', response.status);
                const result = await response.json();
                hideLoading(loadingModal);
                
                if (result.success) {
                    document.querySelector('#titleResult .result-content').innerHTML = formatAIResponse(result.data);
                    document.getElementById('titleResult').classList.remove('d-none');
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                hideLoading(loadingModal);
                console.error('Error generating title:', error);
                alert('Terjadi kesalahan saat membuat judul');
            }
        });
    } else {
        console.error('Generate title form not found');
    }
    
    // Improve Title Form Submit
    const improveTitleFormOld = document.getElementById('improveTitleForm');
    if (improveTitleFormOld) {
        improveTitleFormOld.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Improve title form submitted');
            
            const title = document.getElementById('title').value.trim();
            if (!title) {
                alert('Mohon masukkan judul skripsi');
                return;
            }
            
            const loadingModal = showLoading();
            
            try {
                const response = await fetch('/dashboard/skripsi/api/improve-title', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title })
                });
                
                console.log('Response status:', response.status);
                const result = await response.json();
                hideLoading(loadingModal);
                
                if (result.success) {
                    document.querySelector('#improveTitleResult .result-content').innerHTML = formatAIResponse(result.data);
                    document.getElementById('improveTitleResult').classList.remove('d-none');
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                hideLoading(loadingModal);
                console.error('Error improving title:', error);
                alert('Terjadi kesalahan saat memperbaiki judul');
            }
        });
    } else {
        console.error('Improve title form not found');
    }
    
    // Generic function to handle chapter generation
    async function generateChapter(title, type, additionalInfo, resultContainerId) {
      if (!title) {
        alert('Mohon masukkan judul skripsi');
        return;
      }
      
      const loadingModal = showLoading();
      currentTitle = title;
      currentType = type;
      
      try {
        const response = await fetch('/dashboard/skripsi/api/generate-chapter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            title, 
            type, 
            additionalInfo: additionalInfo || '' 
          })
        });
        
        const result = await response.json();
        hideLoading(loadingModal);
        
        if (result.success) {
          const resultContent = document.querySelector(`#${resultContainerId} .result-content`);
          resultContent.innerHTML = formatAIResponse(result.data);
          document.getElementById(resultContainerId).classList.remove('d-none');
          currentContent = result.data;
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        hideLoading(loadingModal);
        console.error('Error generating chapter:', error);
        alert('Terjadi kesalahan saat membuat bab skripsi');
      }
    }
    
    // BAB I Intro Form Submit
    const generateBab1Form = document.getElementById('generateBab1Form');
    if (generateBab1Form) {
        generateBab1Form.addEventListener('submit', function(e) {
          e.preventDefault();
          const title = document.getElementById('bab1Title').value.trim();
          const additionalInfo = document.getElementById('bab1Info').value.trim();
          generateChapter(title, 'bab1-intro', additionalInfo, 'bab1Result');
        });
    }
    
    // BAB I Full Form Submit
    const generateBab1FullForm = document.getElementById('generateBab1FullForm');
    if (generateBab1FullForm) {
        generateBab1FullForm.addEventListener('submit', function(e) {
          e.preventDefault();
          const title = document.getElementById('bab1FullTitle').value.trim();
          const additionalInfo = document.getElementById('bab1FullInfo').value.trim();
          generateChapter(title, 'bab1-full', additionalInfo, 'bab1FullResult');
        });
    }
    
    // Repeat for other BAB forms
    // ...
    
    // Save result buttons click handler
    const saveButtons = document.querySelectorAll('.save-result');
    saveButtons.forEach(button => {
      button.addEventListener('click', async function() {
        const type = this.getAttribute('data-type');
        
        if (!currentTitle || !currentContent) {
          alert('Tidak ada konten yang dapat disimpan');
          return;
        }
        
        try {
          const response = await fetch('/dashboard/skripsi/api/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include', // <-- penting agar session/cookie dikirim!
            body: JSON.stringify({
              title: currentTitle,
              type: type || currentType,
              content: currentContent
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            alert('Skripsi berhasil disimpan!');
            // Refresh riwayat skripsi
            location.reload();
          } else {
            alert('Error: ' + result.message);
          }
        } catch (error) {
          console.error('Error saving skripsi:', error);
          alert('Terjadi kesalahan saat menyimpan skripsi');
        }
      });
    });

    // ----- BAB I Elements Navigation -----
    const elementCards = document.querySelectorAll('.element-card');
    if (elementCards.length > 0) {
        elementCards.forEach(card => {
            card.addEventListener('click', function() {
                const elementType = this.getAttribute('data-element');
                const title = document.getElementById('bab1-title').value.trim();
                const researchPrinciple = document.getElementById('research-principle').value;
                
                if (!title) {
                    alert('Mohon isi judul skripsi terlebih dahulu');
                    document.getElementById('bab1-title').focus();
                    return;
                }
                
                // Tambahkan kelas active dan hapus dari yang lain
                elementCards.forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                
                // Persiapkan konten untuk berbagai jenis elemen
                prepareElementContent(elementType, title, researchPrinciple);
            });
        });
    }

    // Function untuk menyiapkan konten berdasarkan elemen yang dipilih
    function prepareElementContent(elementType, title, researchPrinciple) {
        const editorElement = document.getElementById('bab1-content-editor');
        let promptText = '';
        currentType = elementType;
        
        switch(elementType) {
            case 'latar-belakang':
                promptText = `Tolong buatkan latar belakang ringkas untuk skripsi dengan judul "${title}"`;
                if (researchPrinciple) {
                    promptText += ` menggunakan pendekatan ${researchPrinciple}`;
                }
                break;
            case 'latar-belakang-lengkap':
                promptText = `Tolong buatkan latar belakang lengkap dan mendetail untuk skripsi dengan judul "${title}"`;
                if (researchPrinciple) {
                    promptText += ` menggunakan pendekatan ${researchPrinciple}`;
                }
                break;
            case 'rumusan-masalah':
                promptText = `Tolong buatkan rumusan masalah untuk skripsi dengan judul "${title}"`;
                if (researchPrinciple) {
                    promptText += ` dengan pendekatan ${researchPrinciple}`;
                }
                break;
            case 'tujuan-penelitian':
                promptText = `Tolong buatkan tujuan penelitian untuk skripsi dengan judul "${title}"`;
                if (researchPrinciple) {
                    promptText += ` dengan pendekatan ${researchPrinciple}`;
                }
                break;
            case 'manfaat-penelitian':
                promptText = `Tolong buatkan manfaat penelitian (teoritis dan praktis) untuk skripsi dengan judul "${title}"`;
                if (researchPrinciple) {
                    promptText += ` dengan pendekatan ${researchPrinciple}`;
                }
                break;
            default:
                promptText = `Tolong berikan panduan untuk membuat skripsi dengan judul "${title}"`;
                break;
        }
        
        // Masukkan prompt ke editor
        editorElement.value = promptText;
        // Fokus ke editor
        editorElement.focus();
    }

    // Tombol Submit BAB I
    const bab1SubmitBtnOld = document.getElementById('bab1-submit-btn');
    if (bab1SubmitBtnOld) {
        bab1SubmitBtnOld.addEventListener('click', async function() {
            const title = document.getElementById('bab1-title').value.trim();
            const prompt = document.getElementById('bab1-content-editor').value.trim();
            const researchPrinciple = document.getElementById('research-principle').value;
            
            if (!title) {
                alert('Mohon isi judul skripsi terlebih dahulu');
                document.getElementById('bab1-title').focus();
                return;
            }
            
            if (!prompt) {
                alert('Mohon isi konten yang akan diproses');
                document.getElementById('bab1-content-editor').focus();
                return;
            }
            
            const chapter = 'bab1';
            // Assuming currentType is set to the section name for BAB I elements (e.g., 'latar-belakang')
            const section = currentType || 'unknown-bab1-section'; 
            generateContent(title, prompt, chapter, section, researchPrinciple, 'bab1Result');
        });
    }
    
    // Tombol Paste BAB I
    const bab1PasteBtnOld = document.getElementById('bab1-paste-btn');
    if (bab1PasteBtnOld) {
        bab1PasteBtnOld.addEventListener('click', async function() {
            try {
                const clipboardText = await navigator.clipboard.readText();
                document.getElementById('bab1-content-editor').value = clipboardText;
            } catch (error) {
                console.error('Error accessing clipboard:', error);
                alert('Tidak dapat mengakses clipboard. Pastikan Anda memberikan izin clipboard di browser.');
            }
        });
    }
    
    // Tombol Copy hasil BAB I
    const bab1CopyBtnOld = document.getElementById('bab1-copy-btn');
    if (bab1CopyBtnOld) {
        bab1CopyBtnOld.addEventListener('click', function() {
            const resultText = document.querySelector('#bab1Result .result-content').textContent;
            navigator.clipboard.writeText(resultText)
                .then(() => {
                    // Animasi efek copy berhasil
                    this.innerHTML = '<i class="bi bi-check-circle"></i> Disalin';
                    setTimeout(() => {
                        this.innerHTML = '<i class="bi bi-clipboard-check"></i> Salin';
                    }, 2000);
                })
                .catch(error => {
                    console.error('Error copying to clipboard:', error);
                    alert('Gagal menyalin ke clipboard');
                });
        });
    }
    
    // Tombol Save hasil BAB I
    const bab1SaveBtnOld = document.getElementById('bab1-save-btn');
    if (bab1SaveBtnOld) {
        bab1SaveBtnOld.addEventListener('click', async function() {
            if (!currentTitle || !currentContent) {
                alert('Tidak ada konten yang dapat disimpan');
                return;
            }
            
            try {
                const response = await fetch('/dashboard/skripsi/api/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // <-- penting agar session/cookie dikirim!
                    body: JSON.stringify({
                        title: currentTitle,
                        type: currentType || 'bab1',
                        content: currentContent
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Konten berhasil disimpan!');
                    // Optional: Refresh halaman atau update UI
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                console.error('Error saving content:', error);
                alert('Terjadi kesalahan saat menyimpan konten');
            }
        });
    }

    // BAB II - Event listeners untuk navigasi elemen skripsi di BAB II
    setupBab2ElementNavigation();

    // Event listener untuk tombol submit BAB II
    const bab2SubmitBtn = document.getElementById('bab2-submit-btn');
    if (bab2SubmitBtn) {
        bab2SubmitBtn.addEventListener('click', handleBab2Submit);
    }

    // Event listener untuk tombol paste BAB II
    const bab2PasteBtn = document.getElementById('bab2-paste-btn');
    if (bab2PasteBtn) {
        bab2PasteBtn.addEventListener('click', handleBab2Paste);
    }

    // Event listener untuk tombol copy hasil BAB II
    const bab2CopyBtn = document.getElementById('bab2-copy-btn');
    if (bab2CopyBtn) {
        bab2CopyBtn.addEventListener('click', function() {
            const resultContent = document.querySelector('#bab2Result .result-content');
            copyToClipboard(resultContent.textContent);
            showToast('Konten berhasil disalin ke clipboard!');
        });
    }

    // Event listener untuk tombol save BAB II
    const bab2SaveBtn = document.getElementById('bab2-save-btn');
    if (bab2SaveBtn) {
        bab2SaveBtn.addEventListener('click', function() {
            const title = document.getElementById('bab2-title').value.trim();
            const resultContent = document.querySelector('#bab2Result .result-content').textContent.trim();
            if (!title) {
                showToast('Judul skripsi tidak boleh kosong', 'warning');
                return;
            }
            if (!resultContent) {
                showToast('Tidak ada konten yang dapat disimpan', 'warning');
                return;
            }
            saveContent(title, currentType || 'bab2', resultContent);
        });
    }

    // BAB IV Tab Functionality
    const bab4Tab = document.getElementById('bab4-content');
    if (!bab4Tab) return;

    const bab4ElementCards = bab4Tab.querySelectorAll('.element-card');
    const bab4TitleInput = document.getElementById('bab4-title');
    const analysisTypeSelect = document.getElementById('analysis-type');
    const bab4ContentEditor = document.getElementById('bab4-content-editor');
    const bab4SubmitBtn = document.getElementById('bab4-submit-btn');
    const bab4PasteBtn = document.getElementById('bab4-paste-btn');
    const bab4Result = document.getElementById('bab4Result');
    const bab4CopyBtn = document.getElementById('bab4-copy-btn');
    const bab4SaveBtn = document.getElementById('bab4-save-btn');

    // Element card selection
    let selectedBab4Element = null;
    
    bab4ElementCards.forEach(card => {
      card.addEventListener('click', function() {
        // Remove active class from all cards
        bab4ElementCards.forEach(c => c.classList.remove('active'));
        
        // Add active class to selected card
        this.classList.add('active');
        
        // Store selected element type
        selectedBab4Element = this.getAttribute('data-element');
        
        // Update placeholder based on selection
        updateBab4Placeholder(selectedBab4Element);
      });
    });

    function updateBab4Placeholder(elementType) {
      let placeholder = '';
      switch(elementType) {
        case 'bab4-intro':
          placeholder = 'Pendahuluan akan memuat pengantar untuk BAB IV...';
          break;
        case 'bab4-full':
          placeholder = 'BAB IV lengkap akan dihasilkan berdasarkan judul dan jenis analisis yang dipilih...';
          break;
        case 'sajian-data':
          placeholder = 'Sajian data akan memuat data-data penelitian...';
          break;
        case 'profil-responden':
          placeholder = 'Deskripsi tentang profil responden penelitian...';
          break;
        // Add more cases for other element types
        default:
          placeholder = 'Pilih elemen BAB IV dari navigasi di atas, lalu klik Kirim untuk menghasilkan konten...';
      }
      
      bab4ContentEditor.placeholder = placeholder;
    }

    // Submit button functionality
    bab4SubmitBtn.addEventListener('click', function() {
      if (!selectedBab4Element) {
        showToast('Silakan pilih elemen BAB IV terlebih dahulu', 'warning');
        return;
      }

      const title = bab4TitleInput.value.trim();
      if (!title) {
        showToast('Judul skripsi tidak boleh kosong', 'warning');
        bab4TitleInput.focus(); // Focus on the title input
        return;
      }

      const reqChapter = 'bab4';
      let reqSection = 'unknown-section'; // Default value
      if (selectedBab4Element) {
        if (selectedBab4Element.startsWith(reqChapter + '-')) {
          const sectionPart = selectedBab4Element.substring(reqChapter.length + 1);
          if (sectionPart) { // Ensure the part after 'babX-' is not empty
            reqSection = sectionPart;
          } else {
            showToast('Elemen BAB IV tidak valid. Bagian section kosong.', 'error');
            console.error('Invalid selectedBab4Element, section part is empty:', selectedBab4Element);
            return;
          }
        } else {
          // If it doesn't start with 'bab4-', it might be a legacy or different format.
          // For now, let's assume it could be the section name directly if not empty.
          if(selectedBab4Element.trim() !== '') {
            reqSection = selectedBab4Element;
          } else {
            showToast('Elemen BAB IV tidak valid. Atribut data-element kosong.', 'error');
            console.error('Invalid selectedBab4Element, it is empty:', selectedBab4Element);
            return;
          }
        }
      }

      if (reqSection === 'unknown-section') {
          showToast('Tidak dapat menentukan bagian (section) untuk BAB IV. Elemen tidak valid.', 'error');
          console.error('reqSection ended up as unknown-section. selectedBab4Element:', selectedBab4Element);
          return;
      }

      const promptContent = bab4ContentEditor.value.trim();
      const additionalData = analysisTypeSelect.value;

      // Optional: Add a check if prompt is empty AND section is generic like 'full' or 'unknown'
      if (!promptContent && (reqSection === 'full' || reqSection === 'unknown-section')) {
        showToast('Mohon isi konten atau pilih elemen BAB IV yang lebih spesifik.', 'warning');
        bab4ContentEditor.focus();
        return;
      }

      // Show loading spinner
      const loadingModalInstanceForBab4 = showLoading();

      const requestData = {
        title: title,
        chapter: reqChapter,
        section: reqSection,
        prompt: promptContent,
        additionalInfo: additionalData
      };

      // Make API call to generate BAB IV content
      fetch('/dashboard/skripsi/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Hide loading spinner
        hideLoading(loadingModalInstanceForBab4);

        if (data.success) {
          // Display result
          bab4Result.classList.remove('d-none');
          const bab4ResultContent = bab4Result.querySelector('.result-content');
          if (bab4ResultContent) {
            bab4ResultContent.innerHTML = formatAIResponse(data.data || data.text);
          }
          
          // Store result in a data attribute for copying/saving and update currentContent
          bab4Result.setAttribute('data-result', data.data || data.text);
          currentTitle = title;
          currentType = reqChapter + '-' + reqSection;
          currentContent = data.data || data.text;

          // Scroll to result
          bab4Result.scrollIntoView({ behavior: 'smooth' });
        } else {
          showToast(data.message || 'Gagal menghasilkan konten BAB IV.', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        hideLoading(loadingModalInstanceForBab4);
        showToast('Terjadi kesalahan saat menghasilkan konten BAB IV. Silakan coba lagi.', 'error');
      });
    });

    // Paste button functionality
    bab4PasteBtn.addEventListener('click', function() {
      navigator.clipboard.readText()
        .then(text => {
          bab4ContentEditor.value = text;
        })
        .catch(err => {
          showAlert('Tidak dapat menyalin dari clipboard. Mohon salin manual.', 'warning');
        });
    });

    // Copy result button functionality
    bab4CopyBtn.addEventListener('click', function() {
      const resultText = bab4Result.getAttribute('data-result');
      
      navigator.clipboard.writeText(resultText)
        .then(() => {
          showAlert('Konten berhasil disalin ke clipboard!', 'success');
        })
        .catch(err => {
          showAlert('Tidak dapat menyalin ke clipboard. Mohon salin manual.', 'warning');
        });
    });

    // Save result button functionality
    bab4SaveBtn.addEventListener('click', function() {
      const resultText = bab4Result.getAttribute('data-result');
      const currentBab4Title = bab4TitleInput.value.trim(); // Get current title from input

      if (!currentBab4Title) {
        showToast('Judul skripsi tidak boleh kosong untuk menyimpan.', 'warning');
        return;
      }
      if (!resultText) {
        showToast('Tidak ada hasil untuk disimpan.', 'warning');
        return;
      }
      if (!selectedBab4Element) {
        showToast('Elemen BAB IV belum dipilih untuk penyimpanan.', 'warning');
        return;
      }

      let sectionToSave = 'unknown-section';
      if (selectedBab4Element.startsWith('bab4-')) {
        const sectionPart = selectedBab4Element.substring(5);
        if (sectionPart) sectionToSave = sectionPart;
      } else if (selectedBab4Element.trim() !== '') {
        sectionToSave = selectedBab4Element;
      }

      if (sectionToSave === 'unknown-section') {
        showToast('Tidak dapat menentukan bagian (section) untuk penyimpanan BAB IV.', 'error');
        return;
      }
      
      // Prepare data for saving - align with the generic saveContent which expects 'chapter-section' as type
      const typeToSave = 'bab4-' + sectionToSave;

      // Using the generic saveContent function if applicable
      // For this, currentTitle and currentContent need to be set when content is generated
      // And currentType should be 'bab4-sectionName'
      // The generation part now sets currentTitle, currentType, currentContent correctly.

      saveContent(currentBab4Title, typeToSave, resultText);

      // OLD direct save call for BAB IV - can be removed if generic saveContent is fully adopted
      /*
      const saveData = {
        title: currentBab4Title, 
        content: resultText,
        chapter: 'BAB IV', // This should be 'bab4' for consistency if backend expects that
        section: sectionToSave // This is just the section name
      };

      // Make API call to save the content
      fetch('/skripsi/save-chapter', { // This endpoint is different
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Ensure you are using a consistent toast/alert mechanism
        if (data.success) {
            showToast('BAB IV berhasil disimpan!', 'success');
        } else {
            showToast(data.message || 'Gagal menyimpan BAB IV', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat menyimpan BAB IV. Silakan coba lagi.', 'error');
      });
      */
    });
});

// Function untuk setup navigasi elemen skripsi
function setupElementNavigation() {
    const elementCards = document.querySelectorAll('[data-element]');
    
    elementCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent any default behavior
            
            const elementType = this.getAttribute('data-element');
            const title = document.getElementById('bab1-title')?.value?.trim() || '';
            const researchPrinciple = document.getElementById('research-principle')?.value || '';
            
            // Reset highlight dari semua cards dalam grup yang sama
            const parentGroup = this.closest('.element-navigation');
            if (parentGroup) {
                parentGroup.querySelectorAll('[data-element]').forEach(c => c.classList.remove('active'));
            }
            
            // Highlight element yang dipilih
            this.classList.add('active');
            
            // Validasi judul hanya untuk elemen yang membutuhkannya
            if (!title && elementType !== 'generate-title' && elementType !== 'improve-title') {
                showToast('Mohon isi judul skripsi terlebih dahulu', 'warning');
                document.getElementById('bab1-title')?.focus();
                this.classList.remove('active'); // Remove highlight if validation fails
                return;
            }

            // Handle element latar belakang lengkap secara khusus
            if (elementType === 'latar-belakang-lengkap') {
                showOptionsModal();
                return;
            }
            
            // Handle element latar belakang
            if (elementType === 'latar-belakang') {
                prepareElementContent(elementType, title, researchPrinciple);
                return;
            }
            
            // Siapkan konten untuk elemen lainnya
            prepareElementContent(elementType, title, researchPrinciple);
        });
    });
}

// Function untuk menyiapkan konten berdasarkan elemen yang dipilih
function prepareElementContent(elementType, title, researchPrinciple) {
    const editorElement = document.getElementById('bab1-content-editor');
    let promptText = '';
    currentType = elementType;
    
    switch(elementType) {
        case 'latar-belakang':
            promptText = `Tolong buatkan latar belakang ringkas untuk skripsi dengan judul "${title}"`;
            if (researchPrinciple) {
                promptText += ` menggunakan pendekatan ${researchPrinciple}`;
            }
            break;
        case 'latar-belakang-lengkap':
            promptText = `Tolong buatkan latar belakang lengkap dan mendetail untuk skripsi dengan judul "${title}"`;
            if (researchPrinciple) {
                promptText += ` menggunakan pendekatan ${researchPrinciple}`;
            }
            break;
        case 'rumusan-masalah':
            promptText = `Tolong buatkan rumusan masalah untuk skripsi dengan judul "${title}"`;
            if (researchPrinciple) {
                promptText += ` dengan pendekatan ${researchPrinciple}`;
            }
            break;
        case 'tujuan-penelitian':
            promptText = `Tolong buatkan tujuan penelitian untuk skripsi dengan judul "${title}"`;
            if (researchPrinciple) {
                promptText += ` dengan pendekatan ${researchPrinciple}`;
            }
            break;
        case 'manfaat-penelitian':
            promptText = `Tolong buatkan manfaat penelitian (teoritis dan praktis) untuk skripsi dengan judul "${title}"`;
            if (researchPrinciple) {
                promptText += ` dengan pendekatan ${researchPrinciple}`;
            }
            break;
        default:
            promptText = `Tolong berikan panduan untuk membuat skripsi dengan judul "${title}"`;
            break;
    }
    
    // Masukkan prompt ke editor
    editorElement.value = promptText;
    // Fokus ke editor
    editorElement.focus();
}

// Function untuk menangani submit BAB I
function handleBab1Submit() {
    const title = document.getElementById('bab1-title').value.trim();
    const prompt = document.getElementById('bab1-content-editor').value.trim();
    const researchPrinciple = document.getElementById('research-principle').value;
    
    if (!title) {
        alert('Mohon isi judul skripsi terlebih dahulu');
        document.getElementById('bab1-title').focus();
        return;
    }
    
    if (!prompt) {
        alert('Mohon isi konten yang akan diproses');
        document.getElementById('bab1-content-editor').focus();
        return;
    }
    
    const chapter = 'bab1';
    // Assuming currentType is set to the section name for BAB I elements (e.g., 'latar-belakang')
    const section = currentType || 'unknown-bab1-section'; 
    generateContent(title, prompt, chapter, section, researchPrinciple, 'bab1Result');
}

// Function untuk copy ke clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard');
        })
        .catch(error => {
            console.error('Error copying to clipboard:', error);
            alert('Gagal menyalin ke clipboard');
        });
}

// Function untuk menampilkan toast notification
function showToast(message) {
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-success border-0 position-fixed bottom-0 end-0 m-3';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    document.body.appendChild(toastEl);
    
    if (typeof bootstrap !== 'undefined') {
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        
        // Remove toast element after it's hidden
        toastEl.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toastEl);
        });
    } else {
        // Fallback if Bootstrap is not available
        toastEl.style.display = 'block';
        setTimeout(() => {
            document.body.removeChild(toastEl);
        }, 3000);
    }
}

// Function untuk menangani paste BAB I
function handleBab1Paste() {
    navigator.clipboard.readText()
        .then(text => {
            document.getElementById('bab1-content-editor').value = text;
        })
        .catch(error => {
            console.error('Error accessing clipboard:', error);
            alert('Tidak dapat mengakses clipboard. Pastikan Anda memberikan izin clipboard di browser.');
        });
}

// Function untuk menangani save BAB I
function handleBab1Save() {
    if (!currentTitle || !currentContent) {
        alert('Tidak ada konten yang dapat disimpan');
        return;
    }
    const chapter = 'bab1';
    const section = currentType || 'unknown-bab1-section'; // Fallback, ideally currentType is just the section name
    saveContent(currentTitle, chapter + '-' + section, currentContent);
}

// Function untuk generate konten
async function generateContent(title, prompt, chapter, section, additionalInfo, resultContainerId) {
    showLoadingModal(true);
    currentTitle = title;
    // currentType will be set more specifically now using chapter and section
    
    try {
        console.log('Sending request to generate content with:', { 
            title, chapter, section, prompt, additionalInfo: additionalInfo || '' 
        });
        
        const response = await fetch('/dashboard/skripsi/api/generate-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                title: title,
                prompt: prompt,
                chapter: chapter,
                section: section,
                additionalInfo: additionalInfo || ''
            })
        });
        
        // Check for non-200 response before parsing JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error response (${response.status}):`, errorText);
            throw new Error(`Server responded with status ${response.status}: ${errorText || 'Unknown error'}`);
        }
        
        const result = await response.json();
        showLoadingModal(false);
        
        if (result.success) {
            document.querySelector(`#${resultContainerId} .result-content`).innerHTML = formatAIResponse(result.data);
            document.getElementById(resultContainerId).classList.remove('d-none');
            currentContent = result.data;
            currentType = chapter + '-' + section; // Update currentType to be specific
            
            // Scroll to result
            document.getElementById(resultContainerId).scrollIntoView({ behavior: 'smooth' });
        } else {
            showToast(result.message || 'Terjadi kesalahan saat memproses konten', 'error');
        }
    } catch (error) {
        showLoadingModal(false);
        console.error('Error generating content:', error);
        showToast(`Terjadi kesalahan: ${error.message || 'Unknown error'}`, 'error');
    }
}

// Function untuk save konten
async function saveContent(title, chapter, section, content) {
    try {
        // Handle different parameter formats
        if (arguments.length === 3) {
            // If called with 3 parameters (title, type, content)
            content = section;
            const typeParts = chapter.split('-');
            chapter = typeParts[0] || 'bab1';
            section = typeParts[1] || 'unknown';
        }

        // Validate required fields
        if (!title || !chapter || !section || !content) {
            console.error('Missing required fields:', { title, chapter, section, content });
            throw new Error('Data tidak lengkap. Diperlukan: title, chapter, section, dan content');
        }

        // The URL from your error message
        const apiUrl = '/dashboard/skripsi/api/history/save';

        console.log('Saving content with data:', {
            title,
            chapter,
            section,
            contentLength: content.length
        });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                title,
                chapter,
                section,
                content
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error(`Save failed with status: ${response.status}`, result.message);
            throw new Error(result.message || `Gagal menyimpan konten (${response.status})`);
        }

        if (!result.success) {
            throw new Error(`Gagal menyimpan konten (server error): ${result.message}`);
        }

        showToast('Konten berhasil disimpan!', 'success');
        
        if (typeof refreshHistory === 'function') {
            refreshHistory(chapter);
        }

        return result;
    } catch (error) {
        console.error('Error in saveContent (public/js/skripsi.js):', error);
        showToast(`Error: ${error.message}`, 'danger');
        throw error;
    }
}

// Function untuk refresh history content
async function refreshHistory() {
    try {
        const response = await fetch('/dashboard/skripsi/list');
        const result = await response.json();
        
        if (result.success) {
            const chapters = ['bab1', 'bab2', 'bab3', 'bab4', 'bab5'];
            
            // Clear existing content
            chapters.forEach(chapter => {
                const listContainer = document.getElementById(`${chapter}HistoryList`);
                if (listContainer) {
                    listContainer.innerHTML = '';
                }
            });

            // Group content by chapter
            const groupedContent = {};
            result.data.forEach(item => {
                if (!groupedContent[item.chapter]) {
                    groupedContent[item.chapter] = [];
                }
                groupedContent[item.chapter].push(item);
            });
            
            // Display content for each chapter
            chapters.forEach(chapter => {
                if (groupedContent[chapter]) {
                    displayChapterHistory(chapter, groupedContent[chapter]);
                }
            });
        } else {
            showToast('Gagal memuat riwayat: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error refreshing history:', error);
        showToast('Gagal memuat riwayat', 'error');
    }
}

// Function untuk refresh history tab
async function refreshHistoryTab() {
    try {
        const response = await fetch('/dashboard/skripsi/api/list');
        const result = await response.json();
        
        if (result.success) {
            const historyContent = document.querySelector('#history-content .card-body');
            if (historyContent) {
                if (result.data && result.data.length > 0) {
                    const historyHTML = result.data.map(item => `
                        <div class="skripsi-history-item">
                            <h5>${item.title}</h5>
                            <p class="text-muted">Tipe: ${item.type}</p>
                            <div class="content-preview">${item.content.substring(0, 200)}...</div>
                            <div class="mt-2">
                                <small class="text-muted">Dibuat: ${new Date(item.created_at).toLocaleDateString()}</small>
                            </div>
                        </div>
                    `).join('');
                    historyContent.innerHTML = historyHTML;
                } else {
                    historyContent.innerHTML = `
                        <div class="alert alert-info">
                            Belum ada skripsi yang tersimpan. Gunakan fitur pembuatan skripsi untuk memulai.
                        </div>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Error refreshing history:', error);
        showToast('Gagal memuat riwayat skripsi', 'error');
    }
}

// ------------------------ BAB II Functions ------------------------

// Function untuk setup navigasi elemen BAB II
function setupBab2ElementNavigation() {
    const elementCards = document.querySelectorAll('.element-navigation .element-card');
    
    elementCards.forEach(card => {
        card.addEventListener('click', function() {
            const elementType = this.getAttribute('data-element');
            const titleInput = document.getElementById('bab2-title');
            const title = titleInput ? titleInput.value.trim() : '';
            const selectedApproach = document.getElementById('theory-approach')?.value || '';
            
            console.log('Title value:', title); // Debug log
            
            if (!title) {
                showToast('Mohon isi judul skripsi terlebih dahulu', 'warning');
                if (titleInput) {
                    titleInput.focus();
                }
                return;
            }
            
            // Reset highlight
            elementCards.forEach(c => c.classList.remove('active'));
            // Highlight selected element
            this.classList.add('active');
            
            // Siapkan konten berdasarkan elemen yang dipilih
            prepareBab2ElementContent(elementType, title, selectedApproach);
        });
    });
}

// Function untuk menyiapkan konten berdasarkan elemen BAB II yang dipilih
function prepareBab2ElementContent(elementType, title, selectedApproach) {
    const editorElement = document.getElementById('bab2-content-editor');
    if (!editorElement) {
        console.error('Editor element not found');
        return;
    }

    let promptText = '';
    currentType = 'bab2-' + elementType;
    
    switch(elementType) {
        case 'teori-utama':
            promptText = `Tolong buatkan teori utama untuk kajian pustaka/landasan teori (BAB II) skripsi dengan judul "${title}"`;
            if (selectedApproach) {
                promptText += ` menggunakan pendekatan teoritis ${selectedApproach}`;
            }
            break;
        case 'landasan-teori-tetap':
            promptText = `Tolong buatkan landasan teori yang baku/tetap untuk skripsi dengan judul "${title}"`;
            if (selectedApproach) {
                promptText += ` menggunakan pendekatan ${selectedApproach}`;
            }
            promptText += `. Sertakan referensi dan sitasi yang relevan.`;
            break;
        case 'landasan-teori-bebas':
            promptText = `Tolong buatkan landasan teori bebas dan komprehensif untuk skripsi dengan judul "${title}"`;
            if (selectedApproach) {
                promptText += ` menggunakan pendekatan ${selectedApproach}`;
            }
            promptText += `. Berikan pembahasan mendalam dengan referensi terbaru.`;
            break;
        case 'tinjauan-pustaka':
            promptText = `Tolong buatkan tinjauan pustaka dari penelitian terdahulu untuk skripsi dengan judul "${title}"`;
            if (selectedApproach) {
                promptText += ` dengan pendekatan ${selectedApproach}`;
            }
            promptText += `. Sertakan minimal 5 contoh penelitian relevan dengan detail judul, tahun, peneliti, dan temuan utama.`;
            break;
        case 'hipotesis-fokus':
            promptText = `Tolong buatkan hipotesis (jika kuantitatif) atau fokus analisis (jika kualitatif) untuk skripsi dengan judul "${title}"`;
            if (selectedApproach) {
                promptText += ` dengan pendekatan ${selectedApproach}`;
            }
            promptText += `. Jelaskan alur pemikiran penelitian secara logis dan sistematis.`;
            break;
        default:
            promptText = `Tolong berikan ringkasan kajian pustaka untuk skripsi dengan judul "${title}"`;
            break;
    }
    
    // Masukkan prompt ke editor
    editorElement.value = promptText;
    // Fokus ke editor
    editorElement.focus();
}

// Function untuk menangani submit BAB II
function handleBab2Submit() {
    const title = document.getElementById('bab2-title').value.trim();
    const prompt = document.getElementById('bab2-content-editor').value.trim();
    const selectedApproach = document.getElementById('theory-approach').value;
    
    if (!title) {
        alert('Mohon isi judul skripsi terlebih dahulu');
        document.getElementById('bab2-title').focus();
        return;
    }
    
    if (!prompt) {
        alert('Mohon isi konten yang akan diproses');
        document.getElementById('bab2-content-editor').focus();
        return;
    }
    
    const chapter = 'bab2';
    // Derives section from currentType like "bab2-teori-utama" -> "teori-utama"
    const section = currentType ? (currentType.startsWith('bab2-') ? currentType.substring(5) : currentType) : 'unknown-bab2-section';
    generateContent(title, prompt, chapter, section, selectedApproach, 'bab2Result');
}

// Function untuk copy ke clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard');
        })
        .catch(error => {
            console.error('Error copying to clipboard:', error);
            alert('Gagal menyalin ke clipboard');
        });
}

// Function untuk menampilkan toast notification
function showToast(message) {
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-success border-0 position-fixed bottom-0 end-0 m-3';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    document.body.appendChild(toastEl);
    
    if (typeof bootstrap !== 'undefined') {
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        
        // Remove toast element after it's hidden
        toastEl.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toastEl);
        });
    } else {
        // Fallback if Bootstrap is not available
        toastEl.style.display = 'block';
        setTimeout(() => {
            document.body.removeChild(toastEl);
        }, 3000);
    }
}

// Function untuk menangani paste BAB II
function handleBab2Paste() {
    navigator.clipboard.readText()
        .then(text => {
            document.getElementById('bab2-content-editor').value = text;
        })
        .catch(error => {
            console.error('Error accessing clipboard:', error);
            alert('Tidak dapat mengakses clipboard. Pastikan Anda memberikan izin clipboard di browser.');
        });
}

// Function untuk menangani save BAB II
function handleBab2Save() {
    if (!currentTitle || !currentContent) {
        alert('Tidak ada konten yang dapat disimpan');
        return;
    }
    // currentType should be like 'bab2-teori-utama'
    saveContent(currentTitle, currentType || 'bab2-unknown', currentContent);
}

// Function untuk menangani submit form judul
async function handleGenerateTitleSubmit(e) {
    e.preventDefault();
    
    const topic = document.getElementById('topic').value;
    
    if (!topic) {
        showToast('Mohon masukkan tema/topik skripsi terlebih dahulu!', 'error');
        return;
    }
    
    // Tampilkan loading modal
    showLoadingModal(true);
    
    try {
        const prompt = `Berikan 5 rekomendasi judul skripsi yang bagus dan spesifik untuk topik: ${topic}. 
                      Format judul dengan nomor 1-5, dan setiap judul diikuti dengan penjelasan singkat mengapa judul tersebut bagus.`;
        
        // Kirim prompt ke API OpenRouter
        const response = await sendToAI(prompt);
        
        // Tampilkan hasil
        const resultElement = document.querySelector('#titleResult .result-content');
        resultElement.textContent = response;
        document.getElementById('titleResult').classList.remove('d-none');
        
        // Sembunyikan loading modal
        showLoadingModal(false);
        
        // Scroll ke hasil
        resultElement.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat memproses prompt. Silakan coba lagi.', 'error');
        showLoadingModal(false);
    }
}

// Fungsi untuk menangani submit form perbaikan judul
async function handleImproveTitleSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    
    if (!title) {
        showToast('Mohon masukkan judul yang ingin diperbaiki terlebih dahulu!', 'error');
        return;
    }
    
    // Tampilkan loading modal
    showLoadingModal(true);
    
    try {
        const prompt = `Saya memiliki judul skripsi: "${title}"
                      Tolong perbaiki judul ini agar lebih spesifik, jelas, dan menarik. 
                      Berikan 3 alternatif judul yang lebih baik beserta penjelasan mengapa judul tersebut lebih baik.`;
        
        // Kirim prompt ke API OpenRouter
        const response = await sendToAI(prompt);
        
        // Tampilkan hasil
        const resultElement = document.querySelector('#improveTitleResult .result-content');
        resultElement.textContent = response;
        document.getElementById('improveTitleResult').classList.remove('d-none');
        
        // Sembunyikan loading modal
        showLoadingModal(false);
        
        // Scroll ke hasil
        resultElement.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat memproses prompt. Silakan coba lagi.', 'error');
        showLoadingModal(false);
    }
}

// Function untuk setup navigasi elemen skripsi BAB II
function setupBab2ElementNavigation() {
    const bab2ElementCards = document.querySelectorAll('.bab2-element-card');
    
    bab2ElementCards.forEach(card => {
        card.addEventListener('click', function() {
            const elementType = this.getAttribute('data-element');
            const title = document.getElementById('bab2-title').value;
            
            // Reset highlight
            bab2ElementCards.forEach(c => c.classList.remove('active'));
            // Highlight selected element
            this.classList.add('active');
            
            // Siapkan konten berdasarkan elemen yang dipilih
            prepareBab2ElementContent(elementType, title);
        });
    });
}

// Function untuk menyiapkan konten BAB II berdasarkan elemen yang dipilih
function prepareBab2ElementContent(elementType, title) {
    const editorElement = document.getElementById('bab2-content-editor');
    let promptText = '';
    currentType = 'bab2-' + elementType; // Corrected: ensure 'bab2-' prefix
    
    switch(elementType) {
        case 'teori-utama':
            promptText = `Tolong buatkan tinjauan teoritis tentang teori utama (teori kekuasaan, demokrasi deliberatif, atau otoritarianisme) untuk skripsi dengan judul "${title}".`;
            break;
        case 'teori-klasik':
            promptText = `Tolong buatkan landasan teori tentang teori demokrasi klasik (seperti Dahl, Schumpeter) untuk skripsi dengan judul "${title}".`;
            break;
        case 'teori-kontemporer':
            promptText = `Tolong buatkan landasan teori tentang teori kontemporer (seperti populisme dan politik pasca-kebenaran) untuk skripsi dengan judul "${title}".`;
            break;
        case 'tinjauan-pustaka':
            promptText = `Tolong buatkan tinjauan pustaka dari penelitian terdahulu tentang kemunduran demokrasi dan studi otoriterisme dalam demokrasi untuk skripsi dengan judul "${title}".`;
            break;
        case 'hipotesis':
            promptText = `Tolong buatkan hipotesis (jika kuantitatif) atau fokus analisis (jika kualitatif) untuk skripsi dengan judul "${title}".`;
            break;
        case 'kerangka-teori':
            promptText = `Tolong buatkan kerangka teori lengkap yang mengintegrasikan semua teori yang digunakan untuk skripsi dengan judul "${title}".`;
            break;
        default:
            promptText = `Tolong berikan panduan untuk membuat BAB II (Tinjauan Pustaka & Kerangka Teori) skripsi dengan judul "${title}".`;
            break;
    }
    
    // Masukkan prompt ke editor
    editorElement.value = promptText;
    // Fokus ke editor
    editorElement.focus();
}

// Function untuk menangani submit BAB II
async function handleBab2Submit() {
    const title = document.getElementById('bab2-title').value;
    const promptText = document.getElementById('bab2-content-editor').value;
    
    if (!title) {
        showToast('Mohon masukkan judul skripsi terlebih dahulu!', 'error');
        return;
    }
    
    if (!promptText) {
        showToast('Mohon masukkan prompt terlebih dahulu!', 'error');
        return;
    }
    
    // Tampilkan loading modal
    showLoadingModal(true);
    
    try {
        // This version of handleBab2Submit directly calls sendToAI.
        // We need to ensure this path is also providing chapter and section if it were to save via a generic mechanism.
        // However, its save function handleBab2Save seems to use currentType correctly.
        // For now, focusing on generateContent path for the 400 errors.
        // If this path needs to save via the generic saveContent that expects chapter and section,
        // then `currentType` needs to be `bab2-someSection` and `sendToAI` would need to update `currentContent`.

        // Kirim prompt ke API OpenRouter
        const response = await sendToAI(promptText);
        
        // Tampilkan hasil
        const resultElement = document.querySelector('#bab2Result .result-content');
        resultElement.textContent = response;
        document.getElementById('bab2Result').classList.remove('d-none');
        
        // Sembunyikan loading modal
        showLoadingModal(false);
        
        // Scroll ke hasil
        resultElement.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat memproses prompt. Silakan coba lagi.', 'error');
        showLoadingModal(false);
    }
}

// Function untuk menangani paste text dari clipboard untuk BAB II
async function handleBab2Paste() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('bab2-content-editor').value = text;
    } catch (error) {
        console.error('Failed to read clipboard contents:', error);
        showToast('Gagal membaca clipboard. Pastikan Anda mengizinkan akses clipboard.', 'error');
    }
}

// Function untuk menyimpan hasil BAB II
async function handleBab2Save() {
    const title = document.getElementById('bab2-title').value;
    const resultContent = document.querySelector('#bab2Result .result-content').textContent;
    
    if (!title) {
        showToast('Mohon masukkan judul skripsi terlebih dahulu!', 'error');
        return;
    }
    
    if (!resultContent) {
        showToast('Tidak ada konten untuk disimpan!', 'error');
        return;
    }
    
    // Siapkan data untuk dikirim
    const data = {
        title,
        type: currentType || 'bab2-unknown', // Ensure currentType is like 'bab2-section'
        content: resultContent,
        chapter: 'bab2', // Explicitly add chapter
        section: currentType ? (currentType.startsWith('bab2-') ? currentType.substring(5) : currentType) : 'unknown' // Explicitly add section
    };
    
    try {
      // Assuming this save endpoint is different or older. 
      // The more generic saveContent function is preferred.
      // For now, let's ensure this specific save function for BAB II also sends chapter and section if the server expects it.
      // The existing saveContent function takes `title, type, content`. If `type` is `chapter-section`, it's fine.
      // Let's adjust type to be chapter-section for this specific save function.
        const response = await fetch('/skripsi/save', { // This endpoint might be different from /dashboard/skripsi/api/save
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // <-- penting agar session/cookie dikirim!
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Berhasil menyimpan konten skripsi!', 'success');
        } else {
            showToast(result.message || 'Gagal menyimpan konten skripsi.', 'error');
        }
    } catch (error) {
        console.error('Error saving skripsi content:', error);
        showToast('Terjadi kesalahan saat menyimpan konten skripsi.', 'error');
    }
}

// Function untuk mengirim prompt ke AI dengan token limit dan fallback
async function sendToAI(prompt) {
    // Daftar model AI yang akan dicoba
    const models = [
        {
            name: 'anthropic/claude-3-haiku:beta',
            maxTokens: 200,
            temperature: 0.7
        },
        {
            name: 'google/gemini-1.5-pro',
            maxTokens: 200,
            temperature: 0.7
        },
        {
            name: 'openai/gpt-3.5-turbo',
            maxTokens: 200,
            temperature: 0.7
        },
        {
            name: 'meta-llama/llama-2-70b-chat',
            maxTokens: 200,
            temperature: 0.7
        },
        {
            name: 'mistral/mistral-7b-instruct',
            maxTokens: 200,
            temperature: 0.7
        }
    ];

    let lastError = null;

    // Mencoba setiap model secara berurutan
    for (const model of models) {
        try {
            console.log(`Trying model: ${model.name}...`);
            
            const response = await fetch(openrouterApiUrl + '/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openrouterApiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Skripsi Generator'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'Kamu adalah asisten akademik yang membantu mahasiswa menulis skripsi dengan bahasa Indonesia formal akademis. Berikan jawaban yang terstruktur dan detail.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    model: model.name,
                    max_tokens: model.maxTokens,
                    temperature: model.temperature
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error with model ${model.name}:`, response.status, errorText);
                throw new Error(`API responded with status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || 'Unknown error');
            }

            // Extract content from response with multiple fallback options
            let content = '';
            if (data.choices && data.choices[0]) {
                if (data.choices[0].message && data.choices[0].message.content) {
                    content = data.choices[0].message.content;
                } else if (data.choices[0].text) {
                    content = data.choices[0].text;
                }
            } else if (data.output) {
                content = data.output;
            } else if (data.response) {
                content = data.response;
            }

            if (!content) {
                throw new Error('No valid content in response');
            }

            // Successful response, add model info and return
            return `[Model: ${model.name}]\n\n${content}`;

        } catch (error) {
            console.error(`Failed with model ${model.name}:`, error);
            lastError = error;
            // Continue to next model
            continue;
        }
    }

    // If all models failed, throw the last error
    throw lastError || new Error('All AI models failed');
}

// Function untuk copy text ke clipboard
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// Function untuk menampilkan loading modal
function showLoadingModal(show) {
    const modal = new bootstrap.Modal(document.getElementById('loadingModal'));
    if (show) {
        modal.show();
    } else {
        modal.hide();
    }
}

// Function untuk menampilkan toast notification
function showToast(message, type = 'success') {
    // Cek apakah ada elemen toast container, jika tidak, buat baru
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Buat elemen toast
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : 'success'} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    // Isi toast
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Tambahkan toast ke container
    toastContainer.appendChild(toastEl);
    
    // Inisialisasi toast dan tampilkan
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    // Hapus toast dari DOM setelah hilang
    toastEl.addEventListener('hidden.bs.toast', function() {
        toastEl.remove();
    });
}

// Helper function to get additional info based on chapter
function getAdditionalInfoForChapter(chapterName) {
  let additionalInfo = '';
  if (chapterName === 'bab1') {
    const researchPrincipleEl = document.getElementById('research-principle');
    if (researchPrincipleEl) additionalInfo = researchPrincipleEl.value;
  } else if (chapterName === 'bab2') {
    const theoryApproachEl = document.getElementById('theory-approach');
    if (theoryApproachEl) additionalInfo = theoryApproachEl.value;
  } else if (chapterName === 'bab3') {
    const researchTypeEl = document.getElementById('research-type');
    if (researchTypeEl) additionalInfo = researchTypeEl.value;
  } else if (chapterName === 'bab4') {
    const analysisTypeEl = document.getElementById('analysis-type');
    if (analysisTypeEl) additionalInfo = analysisTypeEl.value;
  } else if (chapterName === 'bab5') {
    const conclusionFormatEl = document.getElementById('conclusion-format');
    if (conclusionFormatEl) additionalInfo = conclusionFormatEl.value;
  }
  return additionalInfo;
}

// BAB V Functionality
document.addEventListener('DOMContentLoaded', function() {
  // Elements for BAB V
  const bab5Tab = document.getElementById('bab5-tab');
  if (!bab5Tab) return;
  
  const bab5ElementCards = document.querySelectorAll('.bab5-element-card');
  const bab5TitleInput = document.getElementById('bab5-title');
  const conclusionFormatSelect = document.getElementById('conclusion-format');
  const bab5ContentEditor = document.getElementById('bab5-content-editor');
  const bab5SubmitBtn = document.getElementById('bab5-submit-btn');
  const bab5PasteBtn = document.getElementById('bab5-paste-btn');
  const bab5Result = document.getElementById('bab5Result');
  const bab5CopyBtn = document.getElementById('bab5-copy-btn');
  const bab5SaveBtn = document.getElementById('bab5-save-btn');

  // Element card selection
  let selectedBab5Element = null;
  
  bab5ElementCards.forEach(card => {
    card.addEventListener('click', function() {
      // Remove active class from all cards
      bab5ElementCards.forEach(c => c.classList.remove('active'));
      
      // Add active class to selected card
      this.classList.add('active');
      
      // Store selected element type
      selectedBab5Element = this.getAttribute('data-element');
      
      // Update placeholder based on selection
      updateBab5Placeholder(selectedBab5Element);
    });
  });

  function updateBab5Placeholder(elementType) {
    let placeholder = '';
    switch(elementType) {
      case 'bab5-intro':
        placeholder = 'Pendahuluan akan memuat pengantar untuk BAB V (Kesimpulan dan Saran)...';
        break;
      case 'bab5-full':
        placeholder = 'BAB V lengkap akan dihasilkan berdasarkan judul dan format kesimpulan yang dipilih...';
        break;
      case 'kesimpulan':
        placeholder = 'Kesimpulan akan memuat ringkasan hasil penelitian...';
        break;
      case 'saran':
        placeholder = 'Saran akan memuat rekomendasi berdasarkan hasil penelitian...';
        break;
      case 'kesimpulan-saran':
        placeholder = 'Kesimpulan dan saran akan memuat ringkasan hasil dan rekomendasi penelitian...';
        break;
      default:
        placeholder = 'Pilih elemen BAB V dari navigasi di atas, lalu klik Kirim untuk menghasilkan konten...';
    }
    
    bab5ContentEditor.placeholder = placeholder;
  }

  // Submit button functionality
  if (bab5SubmitBtn) {
    bab5SubmitBtn.addEventListener('click', function() {
      if (!selectedBab5Element) {
        showToast('Silakan pilih elemen BAB V terlebih dahulu', 'error');
        return;
      }

      if (!bab5TitleInput.value.trim()) {
        showToast('Judul skripsi tidak boleh kosong', 'warning');
        return;
      }

      const loadingModal = showLoading();

      // Prepare data for API call
      const reqChapter = 'bab5';
      const reqSection = selectedBab5Element ? (selectedBab5Element.startsWith('bab5-') ? selectedBab5Element.substring(5) : selectedBab5Element) : 'unknown-section';
      const additionalData = conclusionFormatSelect.value;

      const requestData = {
        title: bab5TitleInput.value.trim(),
        chapter: reqChapter,
        section: reqSection,
        prompt: bab5ContentEditor.value.trim(),
        additionalInfo: additionalData
      };

      // Make API call to generate BAB V content
      fetch('/dashboard/skripsi/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        hideLoading(loadingModal);

        if (data.success) {
          // Display result
          bab5Result.classList.remove('d-none');
          bab5Result.querySelector('.result-content').innerHTML = formatAIResponse(data.data);
          
          // Store current content for saving
          currentTitle = bab5TitleInput.value.trim();
          currentType = reqChapter + '-' + reqSection;
          currentContent = data.data;
          
          // Scroll to result
          bab5Result.scrollIntoView({ behavior: 'smooth' });
        } else {
          showToast(data.message || 'Terjadi kesalahan saat menghasilkan konten.', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        hideLoading(loadingModal);
        showToast('Terjadi kesalahan saat menghasilkan konten BAB V. Silakan coba lagi.', 'error');
      });
    });
  }

  // Paste button functionality
  if (bab5PasteBtn) {
    bab5PasteBtn.addEventListener('click', function() {
      navigator.clipboard.readText()
        .then(text => {
          bab5ContentEditor.value = text;
        })
        .catch(err => {
          showToast('Tidak dapat menyalin dari clipboard. Mohon salin manual.', 'warning');
        });
    });
  }

  // Copy result button functionality
  if (bab5CopyBtn) {
    bab5CopyBtn.addEventListener('click', function() {
      const resultContent = bab5Result.querySelector('.result-content').textContent;
      
      copyToClipboard(resultContent);
      showToast('Konten berhasil disalin ke clipboard!', 'success');
    });
  }

  // Save result button functionality
  if (bab5SaveBtn) {
    bab5SaveBtn.addEventListener('click', function() {
      const title = document.getElementById('bab5-title').value.trim();
      const resultContent = document.querySelector('#bab5Result .result-content').textContent.trim();
      if (!title) {
        showToast('Judul skripsi tidak boleh kosong', 'warning');
        return;
      }
      if (!resultContent) {
        showToast('Tidak ada konten yang dapat disimpan', 'warning');
        return;
      }
      saveContent(title, currentType || 'bab5', resultContent);
    });
  }
});

// ----- KONSULTASI (Chatbot) Functionality -----
// KONSULTASI CHATBOT
document.addEventListener('DOMContentLoaded', function() {
  // Ambil kredensial OpenRouter dari meta tags
  const openrouterApiKey = document.querySelector('meta[name="openrouter-key"]')?.getAttribute('content');
  const openrouterApiUrl = document.querySelector('meta[name="openrouter-url"]')?.getAttribute('content');
  
  console.log('OpenRouter API tersedia:', !!openrouterApiKey, !!openrouterApiUrl);
  
  // Inisialisasi variabel untuk menyimpan pesan chat dan konfigurasi
  let chatMessages = [];
  let knowledgeBase = 'skripsi'; // Default basis pengetahuan
  let aiRole = 'dosen'; // Default peran AI

  // Fungsi untuk mendapatkan elemen-elemen chatbot
  function getChatElements() {
    return {
      chatForm: document.getElementById('chat-form'),
      chatInput: document.getElementById('chat-input'),
      chatMessages: document.getElementById('chat-messages'),
      settingsBtn: document.getElementById('settings-btn'),
      chatConfig: document.getElementById('chat-config'),
      saveConfigBtn: document.getElementById('save-config-btn'),
      knowledgeBaseSelect: document.getElementById('knowledge-base'),
      aiRoleSelect: document.getElementById('ai-role'),
      customKnowledgeContainer: document.getElementById('custom-knowledge-container'),
      customRoleContainer: document.getElementById('custom-role-container')
    };
  }

  // Setup event listeners untuk chatbot
  function setupChatbot() {
    const elements = getChatElements();
    
    // 1. Event listener untuk tombol pengaturan
    if (elements.settingsBtn && elements.chatConfig) {
      elements.settingsBtn.addEventListener('click', function() {
        elements.chatConfig.classList.toggle('d-none');
        console.log('Settings toggled');
      });
    }
    
    // 2. Event listener untuk perubahan knowledge base
    if (elements.knowledgeBaseSelect && elements.customKnowledgeContainer) {
      elements.knowledgeBaseSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
          elements.customKnowledgeContainer.classList.remove('d-none');
        } else {
          elements.customKnowledgeContainer.classList.add('d-none');
        }
      });
    }
    
    // 3. Event listener untuk perubahan AI role
    if (elements.aiRoleSelect && elements.customRoleContainer) {
      elements.aiRoleSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
          elements.customRoleContainer.classList.remove('d-none');
        } else {
          elements.customRoleContainer.classList.add('d-none');
        }
      });
    }
    
    // 4. Event listener untuk tombol simpan konfigurasi
    if (elements.saveConfigBtn) {
      elements.saveConfigBtn.addEventListener('click', function() {
        // Update basis pengetahuan
        if (elements.knowledgeBaseSelect) {
          if (elements.knowledgeBaseSelect.value === 'custom') {
            const customKnowledge = document.getElementById('custom-knowledge');
            if (customKnowledge && customKnowledge.value.trim()) {
              knowledgeBase = customKnowledge.value.trim();
            }
          } else {
            knowledgeBase = elements.knowledgeBaseSelect.value;
          }
        }
        
        // Update peran AI
        if (elements.aiRoleSelect) {
          if (elements.aiRoleSelect.value === 'custom') {
            const customRole = document.getElementById('custom-role');
            if (customRole && customRole.value.trim()) {
              aiRole = customRole.value.trim();
            }
          } else {
            aiRole = elements.aiRoleSelect.value;
          }
        }
        
        // Sembunyikan panel pengaturan
        elements.chatConfig.classList.add('d-none');
        
        // Reset pesan chat dengan instruksi sistem baru
        initializeChat();
        
        // Tampilkan notifikasi
        showToast('Konfigurasi chatbot berhasil diperbarui');
      });
    }
    
    // 5. Event listener untuk form chat - SANGAT PENTING!
    if (elements.chatForm && elements.chatInput) {
      elements.chatForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Mencegah reload halaman
        
        const userMessage = elements.chatInput.value.trim();
        if (!userMessage) return;
        
        // Proses pesan
        handleUserMessage(userMessage);
        
        // Reset input
        elements.chatInput.value = '';
        
        return false; // Untuk mencegah default action
      });
      
      // Event handler untuk Enter key (tanpa Shift)
      elements.chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const userMessage = this.value.trim();
          if (userMessage) {
            handleUserMessage(userMessage);
            this.value = '';
          }
        }
      });
    }
    
    // Inisialisasi chat dengan pesan selamat datang dari AI
    initializeChat();
  }

  // Fungsi untuk inisialisasi chat
  function initializeChat() {
    // Reset chatMessages
    chatMessages = [];
    
    // Buat system message berdasarkan role dan knowledge base
    let systemContent = '';
    
    // Set peran AI
    switch(aiRole) {
      case 'dosen':
        systemContent = 'Anda adalah seorang dosen pembimbing skripsi yang berpengalaman. Anda membantu mahasiswa dalam menyusun skripsi dengan memberikan saran, bimbingan, dan koreksi yang konstruktif.';
        break;
      case 'metodolog':
        systemContent = 'Anda adalah ahli metodologi penelitian yang membantu mahasiswa dalam merancang penelitian dengan pendekatan yang sesuai. Anda fokus pada ketepatan metodologi, validitas, dan reliabilitas penelitian.';
        break;
      case 'reviewer':
        systemContent = 'Anda adalah reviewer skripsi yang kritis dan teliti. Anda membantu mengidentifikasi kelemahan dalam skripsi dan memberikan saran perbaikan yang spesifik dan terukur.';
        break;
      case 'editor':
        systemContent = 'Anda adalah editor bahasa akademis yang membantu memperbaiki tata bahasa, struktur kalimat, dan gaya penulisan skripsi agar sesuai dengan standar akademik.';
        break;
      default:
        systemContent = aiRole; // Custom role
        break;
    }
    
    // Tambahkan basis pengetahuan
    switch(knowledgeBase) {
      case 'skripsi':
        systemContent += '\n\nAnda memiliki pengetahuan mendalam tentang struktur dan komponen skripsi, termasuk pendahuluan, tinjauan pustaka, metodologi, analisis data, dan kesimpulan.';
        break;
      case 'metodologi':
        systemContent += '\n\nAnda memiliki pengetahuan mendalam tentang berbagai metodologi penelitian, baik kualitatif maupun kuantitatif, serta desain penelitian yang sesuai untuk berbagai jenis studi.';
        break;
      case 'teori':
        systemContent += '\n\nAnda memiliki pengetahuan luas tentang berbagai teori dan konsep akademis di berbagai bidang, serta bagaimana mengaplikasikannya dalam kerangka teori penelitian.';
        break;
      case 'referensi':
        systemContent += '\n\nAnda ahli dalam sistem referensi dan sitasi akademis, termasuk APA, MLA, Chicago, dan gaya sitasi lainnya, serta praktik terbaik dalam penulisan daftar pustaka.';
        break;
      case 'analisis':
        systemContent += '\n\nAnda ahli dalam teknik analisis data, baik kualitatif maupun kuantitatif, termasuk metode statistik, coding, dan interpretasi hasil penelitian.';
        break;
      default:
        systemContent += '\n\n' + knowledgeBase; // Custom knowledge
        break;
    }
    
    // Tambahkan instruksi umum
    systemContent += '\n\nBerikan jawaban dalam bahasa Indonesia formal akademis. Berikan saran yang konstruktif dan praktis. Fokus pada membantu mahasiswa mengembangkan kemampuan berpikir kritis dan memberikan alasan untuk setiap saran yang diberikan.';
    
    // Tambahkan system message ke chatMessages
    chatMessages.push({
      role: 'system',
      content: systemContent
    });
    
    // Tambahkan welcome message
    const welcomeMessage = 'Halo! Saya adalah asisten AI yang siap membantu Anda dalam penyusunan skripsi. Silakan ajukan pertanyaan atau konsultasikan masalah yang Anda hadapi saat menyusun skripsi.';
    
    // Reset tampilan chat
    const elements = getChatElements();
    if (elements.chatMessages) {
      elements.chatMessages.innerHTML = '';
      addMessageToUI('ai', welcomeMessage);
    }
  }

  // Fungsi untuk menangani pesan dari user
  function handleUserMessage(message) {
    // Tambahkan pesan user ke UI
    addMessageToUI('user', message);
    
    // Tambahkan pesan user ke array chatMessages
    chatMessages.push({
      role: 'user',
      content: message
    });
    
    // Tampilkan indikator "AI sedang mengetik..."
    addThinkingIndicator();
    
    // Panggil API OpenRouter
    callOpenRouterAPI();
  }

  // Fungsi untuk menambahkan pesan ke UI
  function addMessageToUI(sender, content) {
    const elements = getChatElements();
    
    if (!elements.chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Format content jika dari AI (simple markdown support)
    const formattedContent = sender === 'ai' ? 
      content.replace(/\n\n/g, '<br><br>')
             .replace(/\n/g, '<br>')
             .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
             .replace(/\*(.*?)\*\*/g, '<em>$1</em>') : 
      content;
    
    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${formattedContent}</p>
      </div>
    `;
    
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll ke bawah
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  // Fungsi untuk menambahkan indikator "AI sedang mengetik..."
  function addThinkingIndicator() {
    const elements = getChatElements();
    
    if (!elements.chatMessages) return;
    
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message ai-message thinking';
    thinkingDiv.id = 'thinking-indicator';
    thinkingDiv.innerHTML = `
      <div class="message-content">
        <div class="d-flex align-items-center">
          <span class="me-2">AI sedang mengetik</span>
          <div class="spinner-grow spinner-grow-sm" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    `;
    
    elements.chatMessages.appendChild(thinkingDiv);
    
    // Scroll ke bawah
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  // Fungsi untuk menghapus indikator "AI sedang mengetik..."
  function removeThinkingIndicator() {
    const thinkingIndicator = document.getElementById('thinking-indicator');
    if (thinkingIndicator) {
      thinkingIndicator.remove();
    }
  }

  // Fungsi untuk memanggil API OpenRouter untuk mendapatkan respons AI
  async function callOpenRouterAPI() {
    // Validasi API key dan URL
    if (!openrouterApiKey || !openrouterApiUrl) {
      removeThinkingIndicator();
      addMessageToUI('ai', 'Error: API key atau URL tidak tersedia. Harap hubungi administrator.');
      console.error('OpenRouter API credentials missing');
      return;
    }

    // Daftar model AI yang akan dicoba secara berurutan
    const models = [
      'anthropic/claude-3-haiku',
      'anthropic/claude-3-sonnet',
      'openai/gpt-4',
      'openai/gpt-3.5-turbo',
      'google/gemini-pro',
      'meta-llama/llama-2-70b-chat',
      'mistralai/mistral-medium',
      'mistralai/mixtral-8x7b'
    ];

    let lastError = null;

    // Mencoba setiap model secara berurutan hingga berhasil
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}...`);
        
        // Siapkan payload untuk OpenRouter API
        const payload = {
          messages: chatMessages,
          model: model,
          max_tokens: 3000,
          temperature: 0.7,
          stream: false
        };
        
        // Panggil API
        const response = await fetch(openrouterApiUrl + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterApiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Konsultasi Skripsi'
          },
          body: JSON.stringify(payload)
        });

        // Check if response is ok
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error with model ${model}:`, response.status, errorText);
          throw new Error(`API responded with status: ${response.status}`);
        }
        
        // Parse response
        const responseData = await response.json();
        console.log(`Response received from ${model}:`, responseData);
        
        // Extract AI message with improved validation
        let aiMessage = '';
        
        if (responseData && typeof responseData === 'object') {
          if (responseData.choices && Array.isArray(responseData.choices) && responseData.choices.length > 0) {
            const choice = responseData.choices[0];
            
            if (choice.message && typeof choice.message === 'object' && choice.message.content) {
              aiMessage = choice.message.content;
            } else if (choice.text) {
              aiMessage = choice.text;
            } else if (choice.content) {
              aiMessage = choice.content;
            }
          } else if (responseData.output) {
            aiMessage = responseData.output;
          } else if (responseData.response) {
            aiMessage = responseData.response;
          }
          
          if (aiMessage) {
            // Success! Remove thinking indicator
            removeThinkingIndicator();
            
            // Add success message to indicate which model was used
            const modelInfo = `[Menggunakan model: ${model}]\n\n`;
            
            // Tambahkan pesan AI ke UI
            addMessageToUI('ai', modelInfo + aiMessage);
            
            // Tambahkan pesan AI ke array chatMessages
            chatMessages.push({
              role: 'assistant',
              content: aiMessage
            });
            
            // Successfully got a response, exit the loop
            return;
          }
        }
        
        // If we get here, response format was invalid
        throw new Error('Invalid response format from model: ' + model);

      } catch (error) {
        console.error(`Failed with model ${model}:`, error);
        lastError = error;
        // Continue to next model
        continue;
      }
    }

    // If we get here, all models failed
    console.error('All models failed:', lastError);
    removeThinkingIndicator();
    addMessageToUI('ai', 'Maaf, saat ini semua model AI sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat.');
  }

  // Fungsi untuk menampilkan toast
  function showToast(message, type = 'info') {
    // Cek apakah container toast sudah ada
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }
    
    // Buat element toast
    const toastId = 'toast-' + Date.now();
    const toastElement = document.createElement('div');
    toastElement.id = toastId;
    toastElement.className = `toast align-items-center text-white bg-${type} border-0`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    
    toastElement.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    toastContainer.appendChild(toastElement);
    
    // Initialize dan tampilkan toast
    const toast = new bootstrap.Toast(toastElement, {
      delay: 3000
    });
    toast.show();
    
    // Hapus toast setelah hilang
    toastElement.addEventListener('hidden.bs.toast', function() {
      toastElement.remove();
    });
  }

  // Tambahkan CSS untuk styling chatbot
  function addChatbotStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .chat-container {
        display: flex;
        flex-direction: column;
        height: 60vh;
        min-height: 400px;
      }
      
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 0.5rem;
        border: 1px solid #dee2e6;
      }
      
      .message {
        margin-bottom: 1rem;
        display: flex;
      }
      
      .user-message {
        justify-content: flex-end;
      }
      
      .ai-message {
        justify-content: flex-start;
      }
      
      .message-content {
        max-width: 80%;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      
      .user-message .message-content {
        background-color: #0d6efd;
        color: white;
        border-top-right-radius: 0.25rem;
      }
      
      .ai-message .message-content {
        background-color: #e9ecef;
        color: #212529;
        border-top-left-radius: 0.25rem;
      }
      
      .thinking .message-content {
        background-color: #f8f9fa;
        border: 1px dashed #dee2e6;
        color: #6c757d;
      }
      
      .chat-input-area {
        margin-top: 1rem;
      }
      
      .chat-input-area form {
        display: flex;
      }
      
      .chat-input-area textarea {
        resize: none;
        border-radius: 1.5rem;
        padding: 0.5rem 1rem;
      }
      
      .chat-input-area button {
        border-radius: 50%;
        width: 2.5rem;
        height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: flex-end;
      }
    `;
    
    document.head.appendChild(styleElement);
  }

  // Inisialisasi tab Konsultasi
  function initializeKonsultasiTab() {
    const konsultasiTab = document.getElementById('konsultasi-tab');
    
    if (konsultasiTab) {
      konsultasiTab.addEventListener('shown.bs.tab', function() {
        console.log('Konsultasi tab shown');
        const elements = getChatElements();
        if (elements.chatMessages && elements.chatMessages.childElementCount === 0) {
          initializeChat();
        }
      });
    }
    
    // Inisialisasi chatbot juga saat DOM selesai diload, khususnya jika tab Konsultasi sudah aktif
    setupChatbot();
    addChatbotStyles();
  }

  // Jalankan fungsi inisialisasi
  initializeKonsultasiTab();
});

// History tab functionality
document.addEventListener('DOMContentLoaded', () => {
    const historyTab = document.getElementById('history-tab');
    const refreshHistoryBtn = document.getElementById('refresh-history');

    // Sections mapping for better display names
    const sectionNames = {
        // BAB I
        'latar-belakang': 'Latar Belakang',
        'rumusan-masalah': 'Rumusan Masalah',
        'tujuan-penelitian': 'Tujuan Penelitian',
        'manfaat-penelitian': 'Manfaat Penelitian',
        
        // BAB II
        'landasan-teori': 'Landasan Teori',
        'tinjauan-pustaka': 'Tinjauan Pustaka',
        'penelitian-terdahulu': 'Penelitian Terdahulu',
        'kerangka-pemikiran': 'Kerangka Pemikiran',
        'hipotesis': 'Hipotesis',
        
        // BAB III
        'jenis-penelitian': 'Jenis Penelitian',
        'populasi-sampel': 'Populasi dan Sampel',
        'teknik-pengumpulan': 'Teknik Pengumpulan Data',
        'teknik-analisis': 'Teknik Analisis Data',
        'variabel-penelitian': 'Variabel Penelitian',
        
        // BAB IV
        'hasil-penelitian': 'Hasil Penelitian',
        'analisis-data': 'Analisis Data',
        'pembahasan': 'Pembahasan',
        'interpretasi': 'Interpretasi',
        
        // BAB V
        'kesimpulan': 'Kesimpulan',
        'saran': 'Saran',
        'rekomendasi': 'Rekomendasi',
        'keterbatasan': 'Keterbatasan'
    };

    // Refresh history when tab is shown
    historyTab.addEventListener('shown.bs.tab', () => {
        refreshHistory();
    });

    // Refresh button click handler
    refreshHistoryBtn.addEventListener('click', () => {
        refreshHistory();
    });

    // Function to refresh history tab content
    async function refreshHistory() {
        try {
            const response = await fetch('/dashboard/skripsi/list');
            const result = await response.json();
            
            if (result.success) {
                // Clear existing content
                for (let i = 1; i <= 5; i++) {
                    const listContainer = document.getElementById(`bab${i}HistoryList`);
                    if (listContainer) {
                        listContainer.innerHTML = '';
                    }
                }

                // Group content by chapter
                const groupedContent = groupContentByChapter(result.data);
                
                // Display content for each chapter
                Object.keys(groupedContent).forEach(chapter => {
                    const chapterContent = groupedContent[chapter];
                    displayChapterHistory(chapter, chapterContent);
                });
            } else {
                showToast('Gagal memuat riwayat: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error refreshing history:', error);
            showToast('Gagal memuat riwayat', 'error');
        }
    }

    // Function to group content by chapter
    function groupContentByChapter(data) {
        return data.reduce((acc, item) => {
            if (!acc[item.chapter]) {
                acc[item.chapter] = [];
            }
            acc[item.chapter].push(item);
            return acc;
        }, {});
    }

    // Function to display chapter content
    function displayChapterContent(chapter, content) {
        const listContainer = document.getElementById(`${chapter}HistoryList`);
        if (!listContainer) return;

        // Sort content by sequence
        content.sort((a, b) => a.sequence - b.sequence);

        // Create list items
        content.forEach(item => {
            const listItem = createHistoryListItem(item);
            listContainer.appendChild(listItem);
        });
    }

    // Function to create a history list item
    function createHistoryListItem(item) {
        const div = document.createElement('div');
        div.className = 'list-group-item list-group-item-action';
        div.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <h6 class="mb-1">${getSectionDisplayName(item.section)}</h6>
                <small class="text-muted">${new Date(item.created_at).toLocaleDateString()}</small>
            </div>
            <p class="mb-1 text-truncate">${item.content.substring(0, 100)}...</p>
            <div class="d-flex justify-content-end gap-2 mt-2">
                <button class="btn btn-sm btn-outline-primary view-content" data-id="${item.id}">
                    <i class="bi bi-eye"></i> Lihat
                </button>
                <button class="btn btn-sm btn-outline-success copy-content" data-id="${item.id}">
                    <i class="bi bi-clipboard"></i> Salin
                </button>
                <button class="btn btn-sm btn-outline-danger delete-content" data-id="${item.id}">
                    <i class="bi bi-trash"></i> Hapus
                </button>
            </div>
        `;

        // Add event listeners
        div.querySelector('.view-content').addEventListener('click', () => viewHistoryContent(item.id));
        div.querySelector('.copy-content').addEventListener('click', () => copyHistoryContent(item.id));
        div.querySelector('.delete-content').addEventListener('click', () => deleteHistoryContent(item.id));

        return div;
    }

    // Function to view content detail
    async function viewHistoryContent(id) {
        try {
            const response = await fetch(`/dashboard/skripsi/api/${id}`);
            const result = await response.json();
            
            if (result.success) {
                const modal = new bootstrap.Modal(document.getElementById('contentViewModal'));
                const modalTitle = document.querySelector('#contentViewModal .modal-title');
                const contentPreview = document.querySelector('#contentViewModal .content-preview');
                
                modalTitle.textContent = getSectionDisplayName(result.data.section);
                contentPreview.innerHTML = result.data.content.replace(/\n/g, '<br>');
                
                modal.show();
            } else {
                showToast('Gagal memuat konten: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error viewing content:', error);
            showToast('Gagal memuat konten', 'error');
        }
    }

    // Function to copy content
    async function copyHistoryContent(id) {
        try {
            const response = await fetch(`/dashboard/skripsi/api/${id}`);
            const result = await response.json();
            
            if (result.success) {
                await navigator.clipboard.writeText(result.data.content);
                showToast('Konten berhasil disalin ke clipboard', 'success');
            } else {
                showToast('Gagal menyalin konten: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error copying content:', error);
            showToast('Gagal menyalin konten', 'error');
        }
    }

    // Function to delete content
    async function deleteHistoryContent(id) {
        if (!confirm('Anda yakin ingin menghapus konten ini?')) return;
        
        try {
            const response = await fetch(`/dashboard/skripsi/api/${id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                showToast('Konten berhasil dihapus', 'success');
                refreshHistory();
            } else {
                showToast('Gagal menghapus konten: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting content:', error);
            showToast('Gagal menghapus konten', 'error');
        }
    }

    // Call refreshHistory initially if the history tab is active
    if (historyTab.classList.contains('active')) {
        refreshHistory();
    }
});

// Handler untuk elemen Latar Belakang Lengkap
document.addEventListener('DOMContentLoaded', function() {
  const latarBelakangLengkapElement = document.querySelector('[data-element="latar-belakang-lengkap"]');
  const uploadModal = new bootstrap.Modal(document.getElementById('uploadModal'));
  const referencesModal = new bootstrap.Modal(document.getElementById('referencesModal'));
  
  if (latarBelakangLengkapElement) {
    latarBelakangLengkapElement.addEventListener('click', function() {
      // Tampilkan modal dengan opsi
      showOptionsModal();
    });
  }

  // Handler untuk tombol upload
  const uploadButton = document.getElementById('uploadButton');
  if (uploadButton) {
    uploadButton.addEventListener('click', handleFileUpload);
  }

  function showOptionsModal() {
    // Buat dan tampilkan modal opsi
    const optionsModalHTML = `
      <div class="modal fade" id="optionsModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Pilih Opsi</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="d-grid gap-2">
                <button class="btn btn-primary" id="showUploadModal">
                  <i class="bi bi-upload"></i> Upload File Baru
                </button>
                <button class="btn btn-secondary" id="showExistingFiles">
                  <i class="bi bi-folder2-open"></i> Lihat File yang Tersedia
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tambahkan modal ke document body
    document.body.insertAdjacentHTML('beforeend', optionsModalHTML);
    const optionsModal = new bootstrap.Modal(document.getElementById('optionsModal'));
    optionsModal.show();

    // Event listener untuk tombol-tombol opsi
    document.getElementById('showUploadModal').addEventListener('click', function() {
      optionsModal.hide();
      uploadModal.show();
    });

    document.getElementById('showExistingFiles').addEventListener('click', function() {
      optionsModal.hide();
      loadAndShowReferences();
    });

    // Cleanup modal setelah hidden
    document.getElementById('optionsModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  }

  async function handleFileUpload() {
    const fileInput = document.getElementById('referenceFile');
    const file = fileInput.files[0];
    
    if (!file) {
      showUploadStatus('Pilih file terlebih dahulu', 'danger');
      return;
    }

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showUploadStatus('Ukuran file terlalu besar (maksimal 5MB)', 'danger');
      return;
    }

    // Validasi tipe file
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      showUploadStatus('Format file tidak didukung. Hanya file PDF dan Word yang diizinkan.', 'danger');
      return;
    }

    const formData = new FormData();
    formData.append('referenceFile', file);

    try {
      showUploadStatus('Mengupload file...', 'info');
      
      const response = await fetch('/dashboard/skripsi/upload-reference', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        showUploadStatus('File berhasil diupload!', 'success');
        // Reset form
        fileInput.value = '';
        // Tunggu sebentar lalu tutup modal
        setTimeout(() => {
          uploadModal.hide();
          // Tambahkan referensi ke textarea
          addReferenceToEditor(result.fileInfo);
        }, 1500);
      } else {
        showUploadStatus(result.message || 'Gagal mengupload file', 'danger');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showUploadStatus('Terjadi kesalahan saat mengupload file', 'danger');
    }
  }

  async function loadAndShowReferences() {
    try {
      const response = await fetch('/dashboard/skripsi/references');
      const result = await response.json();

      if (result.success) {
        displayReferences(result.data);
        referencesModal.show();
      } else {
        showToast('Gagal memuat daftar referensi', 'error');
      }
    } catch (error) {
      console.error('Error loading references:', error);
      showToast('Terjadi kesalahan saat memuat referensi', 'error');
    }
  }

  function displayReferences(references) {
    const referencesList = document.getElementById('referencesList');
    
    if (!references || references.length === 0) {
      referencesList.innerHTML = '<div class="alert alert-info">Belum ada file referensi yang diupload</div>';
      return;
    }

    const referencesHTML = references.map(ref => `
      <div class="reference-item border-bottom p-3">
        <div class="d-flex align-items-center">
          <div class="flex-shrink-0">
            <i class="bi ${ref.mimetype.includes('pdf') ? 'bi-file-pdf' : 'bi-file-word'} fs-2"></i>
          </div>
          <div class="flex-grow-1 ms-3">
            <h6 class="mb-1">${ref.originalName}</h6>
            <p class="mb-1 text-muted">
              <small>
                Ukuran: ${(ref.size / 1024).toFixed(2)} KB<br>
                Diupload: ${new Date(ref.uploadedAt).toLocaleString()}
              </small>
            </p>
          </div>
          <button class="btn btn-primary btn-sm use-reference" data-reference='${JSON.stringify(ref)}'>
            Gunakan
          </button>
        </div>
      </div>
    `).join('');

    referencesList.innerHTML = referencesHTML;

    // Tambahkan event listeners untuk tombol "Gunakan"
    document.querySelectorAll('.use-reference').forEach(button => {
      button.addEventListener('click', function() {
        const reference = JSON.parse(this.dataset.reference);
        addReferenceToEditor(reference);
        referencesModal.hide();
      });
    });
  }

  function addReferenceToEditor(reference) {
    const editor = document.getElementById('bab1-content-editor');
    if (editor) {
      const referenceText = `
[REFERENSI]
Nama File: ${reference.originalName}
Tipe: ${reference.mimetype}
Ukuran: ${(reference.size / 1024).toFixed(2)} KB
Path: ${reference.path}
`;
      
      const currentContent = editor.value;
      editor.value = currentContent + (currentContent ? '\n\n' : '') + referenceText;
    }
  }

  function showUploadStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.className = `alert alert-${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('d-none');
  }
});

function handleGeneratedContent(response, targetElement) {
  if (response.success && response.data) {
    // Clear any previous content
    targetElement.textContent = '';
    
    // Parse and format the content appropriately
    let formattedContent = response.data;
    if (typeof response.data === 'string') {
      formattedContent = response.data.trim();
    } else if (typeof response.data === 'object') {
      formattedContent = JSON.stringify(response.data, null, 2);
    }
    
    // Update the content area
    targetElement.textContent = formattedContent;

    // Show the result container
    targetElement.parentElement.classList.remove('d-none');
  } else {
    // Handle error case
    targetElement.textContent = 'Maaf, terjadi kesalahan saat menghasilkan konten.';
    targetElement.parentElement.classList.remove('d-none');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // ...existing code...

  // Function to handle form submission for each chapter
  async function handleChapterGeneration(event, chapter) {
    event.preventDefault();
    
    // Show loading modal with progress
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    const progressBar = document.getElementById('loadingProgress');
    const timeoutCounter = document.getElementById('timeoutCounter');
    loadingModal.show();

    // Initialize progress and timeout
    let progress = 0;
    let timeLeft = 30;
    
    // Progress animation
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += 5;
        progressBar.style.width = `${progress}%`;
      }
    }, 1000);

    // Timeout counter
    const timeoutInterval = setInterval(() => {
      timeLeft--;
      timeoutCounter.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timeoutInterval);
        clearInterval(progressInterval);
      }
    }, 1000);
    
    try {
      const titleInput = document.getElementById(`${chapter}-title`);
      const contentEditor = document.getElementById(`${chapter}-content-editor`);
      const resultDiv = document.getElementById(`${chapter}Result`);
      const resultContent = resultDiv ? resultDiv.querySelector('.result-content') : null;
      
      if (!titleInput || !titleInput.value.trim()) {
        showToast('Judul skripsi tidak boleh kosong', 'warning');
        loadingModal.hide();
        return;
      }
      
      const promptText = contentEditor ? contentEditor.value.trim() : '';
      
      if (!promptText) {
        showToast('Mohon isi prompt terlebih dahulu', 'warning');
        loadingModal.hide();
        return;
      }

      const reqChapter = chapter;
      // Derive section from currentType. currentType might be 'babX-sectionName' or just 'sectionName'
      let reqSection = currentType || `${chapter}-full`; // Default section
      if (currentType && currentType.startsWith(reqChapter + '-')) {
        reqSection = currentType.substring(reqChapter.length + 1);
      } else if (currentType && !currentType.includes('-')) { // Handles cases where currentType is just section for BAB1
        reqSection = currentType;
      }
      
      const additionalData = getAdditionalInfoForChapter(reqChapter);

      const response = await fetch('/dashboard/skripsi/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: titleInput.value,
          chapter: reqChapter,
          section: reqSection,
          prompt: promptText,
          additionalInfo: additionalData
        }),
        signal: AbortSignal.timeout(28000) // 28 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}: ${errorText || 'Unknown error'}`);
      }
      
      const data = await response.json();

      // Complete the progress bar
      progressBar.style.width = '100%';
      
      // Clear previous content
      if (resultContent) {
        resultContent.innerHTML = '';
      }
      
      if (data.success && data.data) {
        const formattedResponse = formatAIResponse(data.data);
        
        // Update both textarea and result container
        if(contentEditor) contentEditor.value = data.data;
        if(resultContent) resultContent.innerHTML = formattedResponse;
        
        // Show result and scroll
        if(resultDiv) {
          resultDiv.classList.remove('d-none');
          resultDiv.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Store content
        currentTitle = titleInput.value;
        currentContent = data.data;
        currentType = reqChapter + '-' + reqSection;
      } else {
        throw new Error(data.message || 'Gagal menghasilkan konten');
      }
      
    } catch (error) {
      console.error('Error generating chapter:', error);
      const errorMessage = error.message === 'The operation was aborted due to timeout' 
        ? 'Waktu pemrosesan habis. Silakan coba lagi.'
        : `Error: ${error.message}`;
      
      showToast(errorMessage, 'error');
    } finally {
      // Clear intervals and hide loading modal
      clearInterval(progressInterval);
      clearInterval(timeoutInterval);
      loadingModal.hide();
      // PATCH: Always remove modal backdrop and modal-open class
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }
  }

  // Event listeners for chapter generation
  ['bab1', 'bab2', 'bab3', 'bab4', 'bab5'].forEach(chapter => {
    const submitBtn = document.getElementById(`${chapter}-submit-btn`);
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => handleChapterGeneration(e, chapter));
    }
  });

  // ...existing code...
});

// Event listeners for BAB II elements
document.addEventListener('DOMContentLoaded', function() {
    const bab2ElementCards = document.querySelectorAll('[data-element^="teori-"], [data-element^="landasan-"], [data-element^="tinjauan-"], [data-element^="hipotesis-"]');
    
    bab2ElementCards.forEach(card => {
        card.addEventListener('click', function() {
            const elementType = this.getAttribute('data-element');
            const title = document.getElementById('bab2-title').value.trim();
            const theoryApproach = document.getElementById('theory-approach').value;
            
            if (!title) {
                showToast('Mohon isi judul skripsi terlebih dahulu', 'warning');
                document.getElementById('bab2-title').focus();
                return;
            }
            
            // Remove active class from all cards
            bab2ElementCards.forEach(c => c.classList.remove('active'));
            // Add active class to clicked card
            this.classList.add('active');
            
            // Set the current type for the editor
            currentType = 'bab2-' + elementType;
            
            // Prepare prompt based on element type
            let promptText = '';
            switch(elementType) {
                case 'teori-utama':
                    promptText = `Tolong jelaskan teori utama yang relevan untuk skripsi dengan judul "${title}"${theoryApproach ? ` menggunakan pendekatan ${theoryApproach}` : ''}. Berikan penjelasan mendalam tentang konsep kunci, hubungan antar variabel, dan keterkaitan dengan topik penelitian.`;
                    break;
                    
                case 'landasan-teori-tetap':
                    promptText = `Tolong buatkan landasan teori yang baku/standar untuk skripsi dengan judul "${title}"${theoryApproach ? ` dengan pendekatan ${theoryApproach}` : ''}. Sertakan referensi dari teori-teori klasik dan penelitian terbaru yang relevan.`;
                    break;
                    
                case 'landasan-teori-bebas':
                    promptText = `Tolong buatkan landasan teori yang komprehensif dan fleksibel untuk skripsi dengan judul "${title}"${theoryApproach ? ` menggunakan pendekatan ${theoryApproach}` : ''}. Eksplorasi berbagai perspektif teoretis dan kaitkan dengan konteks penelitian.`;
                    break;
                    
                case 'tinjauan-pustaka':
                    promptText = `Tolong buatkan tinjauan pustaka dari penelitian terdahulu untuk skripsi dengan judul "${title}"${theoryApproach ? ` dengan pendekatan ${theoryApproach}` : ''}. Sertakan minimal 5 penelitian relevan dengan format: Nama Peneliti (Tahun) - Judul - Metode - Temuan Utama - Relevansi dengan penelitian ini.`;
                    break;
                    
                case 'hipotesis-fokus':
                    promptText = `Tolong rumuskan ${theoryApproach && theoryApproach.includes('kuantitatif') ? 'hipotesis' : 'fokus analisis'} untuk skripsi dengan judul "${title}"${theoryApproach ? ` dengan pendekatan ${theoryApproach}` : ''}. Jelaskan dasar pemikiran dan kaitannya dengan teori yang digunakan.`;
                    break;
            }
            
            // Set prompt in editor
            const editor = document.getElementById('bab2-content-editor');
            if (editor) {
                editor.value = promptText;
                editor.focus();
            }
        });
    });
});

// ...existing code...

// BAB III: Initialize methodology elements with proper selector and timing
document.addEventListener('DOMContentLoaded', function() {
  // More specific selector to target only BAB III methodology cards
  const bab3Elements = document.querySelectorAll('#bab3-content .methodology-group .element-card');
  let selectedMethodology = null;
  
  bab3Elements.forEach(card => {
    card.addEventListener('click', function(e) {
      const titleInput = document.getElementById('bab3-title');
      const title = titleInput?.value?.trim() || '';
      
      console.log('Title value:', title); // Debug log
      
      // Check if title is empty
      if (!title) {
        e.preventDefault(); // Prevent default behavior
        showToast('Mohon isi judul skripsi terlebih dahulu', 'warning');
        titleInput?.focus();
        return;
      }

      // If we get here, title is not empty, proceed with normal flow
      bab3Elements.forEach(el => el.classList.remove('active'));
      this.classList.add('active');
      
      selectedMethodology = this.getAttribute('data-element');
      const prompt = generateMethodologyPrompt(selectedMethodology, title);
      
      const editor = document.getElementById('bab3-content-editor');
      if (editor && prompt) {
        editor.value = prompt;
        editor.focus();
      }
    });
  });
});

function generateMethodologyPrompt(elementType, title) {
  switch(elementType) {
    case 'pendekatan-kualitatif':
      return `Tolong jelaskan penerapan pendekatan kualitatif yang sesuai untuk penelitian dengan judul "${title}". Sertakan:
1. Alasan pemilihan pendekatan kualitatif
2. Karakteristik pendekatan kualitatif yang relevan
3. Strategi pengumpulan dan analisis data kualitatif
4. Pertimbangan validitas dan reliabilitas`;
      
    case 'pendekatan-kuantitatif':
      return `Tolong jelaskan penerapan pendekatan kuantitatif yang sesuai untuk penelitian dengan judul "${title}". Sertakan:
1. Alasan pemilihan pendekatan kuantitatif
2. Variabel penelitian dan operasionalisasinya
3. Teknik pengumpulan dan analisis data kuantitatif
4. Validitas dan reliabilitas instrumen`;
      
    case 'pengumpulan-wawancara':
      return `Tolong jelaskan metode pengumpulan data melalui wawancara untuk penelitian dengan judul "${title}". Sertakan:
1. Jenis wawancara yang akan digunakan
2. Persiapan instrumen wawancara
3. Prosedur pelaksanaan wawancara
4. Teknik dokumentasi dan analisis hasil wawancara`;

    case 'pengumpulan-kuesioner':
      return `Tolong jelaskan metode pengumpulan data melalui kuesioner untuk penelitian dengan judul "${title}". Sertakan:
1. Jenis dan format kuesioner yang akan digunakan
2. Struktur dan konten kuesioner
3. Skala pengukuran yang digunakan
4. Prosedur distribusi dan pengumpulan kuesioner
5. Teknik pengolahan data kuesioner`;

    case 'pengumpulan-observasi':
      return `Tolong jelaskan metode pengumpulan data melalui observasi untuk penelitian dengan judul "${title}". Sertakan:
1. Jenis observasi yang akan dilakukan
2. Instrumen observasi yang digunakan
3. Prosedur dan tahapan observasi
4. Teknik pencatatan dan dokumentasi
5. Analisis data hasil observasi`;

    case 'pengumpulan-dokumen':
      return `Tolong jelaskan metode pengumpulan data melalui studi dokumen untuk penelitian dengan judul "${title}". Sertakan:
1. Jenis dokumen yang akan dianalisis
2. Sumber dan cara mengakses dokumen
3. Kriteria pemilihan dokumen
4. Prosedur analisis dokumen
5. Teknik pengolahan data dokumen`;

    case 'analisis-statistik':
      return `Tolong jelaskan metode analisis statistik yang akan digunakan dalam penelitian dengan judul "${title}". Sertakan:
1. Jenis analisis statistik yang digunakan
2. Software/tools yang digunakan
3. Tahapan analisis data
4. Interpretasi hasil statistik
5. Penyajian hasil analisis`;

    case 'analisis-tematik':
      return `Tolong jelaskan metode analisis tematik yang akan digunakan dalam penelitian dengan judul "${title}". Sertakan:
1. Tahapan analisis tematik
2. Proses coding dan kategorisasi
3. Identifikasi dan pengembangan tema
4. Validasi tema
5. Penyajian hasil analisis`;

    case 'analisis-konten':
      return `Tolong jelaskan metode analisis konten yang akan digunakan dalam penelitian dengan judul "${title}". Sertakan:
1. Unit analisis yang digunakan
2. Kategori dan coding scheme
3. Prosedur coding
4. Reliabilitas coding
5. Interpretasi hasil analisis`;

    case 'analisis-diskursus':
      return `Tolong jelaskan metode analisis diskursus yang akan digunakan dalam penelitian dengan judul "${title}". Sertakan:
1. Pendekatan analisis diskursus yang dipilih
2. Kerangka analisis yang digunakan
3. Prosedur analisis
4. Interpretasi dan kontekstualisasi
5. Penyajian hasil analisis`;

    case 'populasi-definisi':
      return `Tolong jelaskan definisi dan karakteristik populasi untuk penelitian dengan judul "${title}". Sertakan:
1. Definisi populasi penelitian
2. Karakteristik populasi
3. Kriteria inklusi dan eksklusi
4. Justifikasi pemilihan populasi
5. Ukuran populasi target`;

    case 'sampling-teknik':
      return `Tolong jelaskan teknik sampling yang akan digunakan dalam penelitian dengan judul "${title}". Sertakan:
1. Jenis teknik sampling yang dipilih
2. Alasan pemilihan teknik sampling
3. Prosedur sampling
4. Kriteria pemilihan sampel
5. Penanganan bias sampling`;

    case 'sampling-ukuran':
      return `Tolong jelaskan penentuan ukuran sampel untuk penelitian dengan judul "${title}". Sertakan:
1. Metode penentuan ukuran sampel
2. Formula/rumus yang digunakan
3. Perhitungan ukuran sampel
4. Justifikasi ukuran sampel
5. Pertimbangan margin error`;

    case 'validitas-instrumen':
      return `Tolong jelaskan prosedur validasi instrumen penelitian untuk "${title}". Sertakan:
1. Jenis validitas yang diuji
2. Metode validasi yang digunakan
3. Prosedur pengujian validitas
4. Kriteria validitas
5. Penanganan hasil uji validitas`;

    case 'reliabilitas-instrumen':
      return `Tolong jelaskan prosedur pengujian reliabilitas instrumen untuk "${title}". Sertakan:
1. Jenis reliabilitas yang diuji
2. Metode pengujian reliabilitas
3. Prosedur pengujian
4. Kriteria reliabilitas
5. Penanganan hasil uji reliabilitas`;

    case 'triangulasi':
      return `Tolong jelaskan metode triangulasi yang akan digunakan dalam penelitian "${title}". Sertakan:
1. Jenis triangulasi yang dipilih
2. Alasan pemilihan metode triangulasi
3. Prosedur triangulasi
4. Teknik validasi data
5. Interpretasi hasil triangulasi`;

    case 'desain-eksperimental':
      return `Tolong jelaskan desain eksperimental yang akan digunakan dalam penelitian "${title}". Sertakan:
1. Jenis desain eksperimen
2. Variabel penelitian
3. Kontrol eksperimen
4. Prosedur eksperimental
5. Analisis hasil eksperimen`;

    case 'desain-survei':
      return `Tolong jelaskan desain survei yang akan digunakan dalam penelitian "${title}". Sertakan:
1. Jenis survei yang digunakan
2. Instrumen survei
3. Prosedur pengumpulan data
4. Timeline pelaksanaan
5. Analisis data survei`;

    case 'desain-studi-kasus':
      return `Tolong jelaskan desain studi kasus yang akan digunakan dalam penelitian "${title}". Sertakan:
1. Jenis studi kasus
2. Unit analisis
3. Sumber data
4. Prosedur pengumpulan data
5. Analisis dan interpretasi kasus`;

    case 'desain-etnografi':
      return `Tolong jelaskan desain etnografi yang akan digunakan dalam penelitian "${title}". Sertakan:
1. Pendekatan etnografi yang dipilih
2. Setting penelitian
3. Teknik pengumpulan data
4. Analisis data etnografis
5. Penulisan laporan etnografi`;
      
    default:
      return `Tolong jelaskan metodologi penelitian untuk "${elementType}" dalam penelitian dengan judul "${title}".`;
  }
}

// ...existing code...

// BAB V: Initialize handlers for conclusion and recommendation elements
document.addEventListener('DOMContentLoaded', function() {
  const bab5Elements = document.querySelectorAll('#bab5-content .element-card');
  let selectedBab5Element = null;
  
  bab5Elements.forEach(card => {
    card.addEventListener('click', function() {
      const titleInput = document.getElementById('bab5-title');
      const title = titleInput?.value?.trim() || '';
      
      if (!title) {
        showToast('Mohon isi judul skripsi terlebih dahulu', 'warning');
        titleInput?.focus();
        return;
      }

      // Remove active class from all cards
      bab5Elements.forEach(el => el.classList.remove('active'));
      // Add active class to clicked card
      this.classList.add('active');
      
      selectedBab5Element = this.getAttribute('data-element');
      const conclusionFormat = document.getElementById('conclusion-format')?.value || 'paragraf';
      const prompt = generateBab5Prompt(selectedBab5Element, title, conclusionFormat);
      
      const editor = document.getElementById('bab5-content-editor');
      if (editor && prompt) {
        editor.value = prompt;
        editor.focus();
      }
    });
  });
});

function generateBab5Prompt(elementType, title, format = 'paragraf') {
  const formatInstructions = format === 'poin' ? 
    'Berikan dalam format poin-poin (bullet points)' : 
    format === 'campuran' ? 
    'Kombinasikan paragraf dengan poin-poin penting' : 
    'Berikan dalam format paragraf yang mengalir';

  switch(elementType) {
    case 'ringkasan-temuan':
      return `Tolong buatkan ringkasan temuan penelitian untuk skripsi dengan judul "${title}". ${formatInstructions}. Sertakan:
1. Temuan-temuan utama penelitian
2. Hasil analisis data yang signifikan
3. Pola atau tren yang ditemukan
4. Keterkaitan dengan teori dan penelitian terdahulu
5. Implikasi dari temuan penelitian`;
      
    case 'kesimpulan-umum':
      return `Tolong buatkan kesimpulan umum untuk skripsi dengan judul "${title}". ${formatInstructions}. Sertakan:
1. Ringkasan komprehensif hasil penelitian
2. Jawaban terhadap tujuan penelitian utama
3. Keterkaitan dengan hipotesis/asumsi awal
4. Kontribusi penelitian secara umum
5. Implikasi teoretis dan praktis`;

    case 'kesimpulan-khusus':
      return `Tolong buatkan kesimpulan khusus/spesifik untuk skripsi dengan judul "${title}". ${formatInstructions}. Sertakan:
1. Jawaban rinci untuk setiap rumusan masalah
2. Temuan spesifik untuk setiap variabel/aspek
3. Hasil pengujian setiap hipotesis (jika ada)
4. Detail capaian setiap tujuan penelitian
5. Temuan unik atau tidak terduga`;

    case 'saran-akademis':
      return `Tolong buatkan saran akademis untuk skripsi dengan judul "${title}". ${formatInstructions}. Sertakan:
1. Rekomendasi untuk pengembangan teori
2. Saran untuk metodologi penelitian
3. Aspek yang perlu penelitian lebih lanjut
4. Peluang pengembangan konsep
5. Kontribusi untuk bidang akademik`;

    case 'saran-praktis':
      return `Tolong buatkan saran praktis untuk skripsi dengan judul "${title}". ${formatInstructions}. Sertakan:
1. Rekomendasi implementasi hasil penelitian
2. Saran untuk praktisi/profesional
3. Langkah-langkah perbaikan konkret
4. Solusi untuk masalah yang ditemukan
5. Timeline implementasi jika relevan`;

    case 'penelitian-lanjutan':
      return `Tolong buatkan rekomendasi untuk penelitian lanjutan dari skripsi dengan judul "${title}". ${formatInstructions}. Sertakan:
1. Gap penelitian yang masih perlu diisi
2. Aspek yang belum terjawab
3. Metodologi alternatif yang bisa digunakan
4. Variabel atau faktor yang perlu dieksplorasi
5. Potensi pengembangan penelitian`;
      
    default:
      return `Tolong buatkan konten BAB V (Kesimpulan dan Saran) untuk "${elementType}" dalam skripsi dengan judul "${title}". ${formatInstructions}`;
  }
}

// ...existing code...

// History management functions
function loadHistoryForChapter(chapter) {
  fetch(`/dashboard/skripsi/api/history/${chapter}`)
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        displayChapterHistory(chapter, result.data);
      } else {
        showToast('Gagal memuat riwayat: ' + result.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error loading history:', error);
      showToast('Gagal memuat riwayat', 'error');
    });
}

function displayChapterHistory(chapter, items) {
  const listContainer = document.getElementById(`${chapter}HistoryList`);
  if (!listContainer) return;

  // Clear existing content
  listContainer.innerHTML = '';

  // Sort items by sequence and creation date
  items.sort((a, b) => {
    if (a.sequence === b.sequence) {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return a.sequence - b.sequence;
  });

  // Create and append history items
  items.forEach(item => {
    const historyItem = createHistoryItem(item);
    listContainer.appendChild(historyItem);
  });

  // Show empty state if no items
  if (items.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center text-muted p-4">
        <i class="bi bi-inbox fs-2"></i>
        <p class="mt-2">Belum ada riwayat untuk bagian ini</p>
      </div>
    `;
  }
}

function createHistoryItem(item) {
  const div = document.createElement('div');
  div.className = 'history-item mb-3 p-3 border rounded';
  
  // Format date
  const date = new Date(item.created_at);
  const formattedDate = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  div.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-2">
      <h6 class="mb-0">${getSectionDisplayName(item.section)}</h6>
      <span class="text-muted small">${formattedDate}</span>
    </div>
    <div class="content-preview mb-2">
      ${item.content.substring(0, 200)}...
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-outline-primary view-content" data-id="${item.id}">
        <i class="bi bi-eye"></i> Lihat
      </button>
      <button class="btn btn-sm btn-outline-success copy-content" data-id="${item.id}">
        <i class="bi bi-clipboard"></i> Salin
      </button>
      <button class="btn btn-sm btn-outline-secondary edit-content" data-id="${item.id}">
        <i class="bi bi-pencil"></i> Edit
      </button>
      <button class="btn btn-sm btn-outline-danger delete-content" data-id="${item.id}">
        <i class="bi bi-trash"></i> Hapus
      </button>
    </div>
  `;

  // Add event listeners
  div.querySelector('.view-content').addEventListener('click', () => viewHistoryContent(item.id));
  div.querySelector('.copy-content').addEventListener('click', () => copyHistoryContent(item.id));
  div.querySelector('.edit-content').addEventListener('click', () => editHistoryContent(item.id));
  div.querySelector('.delete-content').addEventListener('click', () => deleteHistoryContent(item.id));

  return div;
}

function getSectionDisplayName(section) {
  const sectionNames = {
    'latar-belakang': 'Latar Belakang',
    'rumusan-masalah': 'Rumusan Masalah',
    'tujuan-penelitian': 'Tujuan Penelitian',
    'manfaat-penelitian': 'Manfaat Penelitian',
    'landasan-teori': 'Landasan Teori',
    'tinjauan-pustaka': 'Tinjauan Pustaka',
    'penelitian-terdahulu': 'Penelitian Terdahulu',
    'kerangka-pemikiran': 'Kerangka Pemikiran',
    'hipotesis': 'Hipotesis',
    'jenis-penelitian': 'Jenis Penelitian',
    'populasi-sampel': 'Populasi dan Sampel',
    'teknik-pengumpulan': 'Teknik Pengumpulan Data',
    'teknik-analisis': 'Teknik Analisis Data',
    'variabel-penelitian': 'Variabel Penelitian',
    'hasil-penelitian': 'Hasil Penelitian',
    'analisis-data': 'Analisis Data',
    'pembahasan': 'Pembahasan',
    'interpretasi': 'Interpretasi',
    'kesimpulan': 'Kesimpulan',
    'saran': 'Saran',
    'rekomendasi': 'Rekomendasi',
    'keterbatasan': 'Keterbatasan'
  };
  return sectionNames[section] || section;
}

// Content view modal functions
function viewHistoryContent(id) {
  fetch(`/dashboard/skripsi/api/${id}`)
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        const modal = new bootstrap.Modal(document.getElementById('contentViewModal'));
        const modalTitle = document.querySelector('#contentViewModal .modal-title');
        const contentPreview = document.querySelector('#contentViewModal .content-preview');
        
        modalTitle.textContent = getSectionDisplayName(result.data.section);
        contentPreview.innerHTML = result.data.content.replace(/\n/g, '<br>');
        
        modal.show();
      } else {
        showToast('Gagal memuat konten: ' + result.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error viewing content:', error);
      showToast('Gagal memuat konten', 'error');
    });
}

function copyHistoryContent(id) {
  fetch(`/dashboard/skripsi/api/${id}`)
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        navigator.clipboard.writeText(result.data.content)
          .then(() => showToast('Konten berhasil disalin', 'success'))
          .catch(() => showToast('Gagal menyalin ke clipboard', 'error'));
      } else {
        showToast('Gagal memuat konten: ' + result.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error copying content:', error);
      showToast('Gagal memuat konten', 'error');
    });
}

function editHistoryContent(id) {
  fetch(`/dashboard/skripsi/api/${id}`)
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        // Switch to appropriate tab
        const tab = document.querySelector(`#${result.data.chapter}-tab`);
        if (tab) {
          const bsTab = new bootstrap.Tab(tab);
          bsTab.show();
          
          // Set content in editor
          const editor = document.getElementById(`${result.data.chapter}-content-editor`);
          if (editor) {
            editor.value = result.data.content;
          }
        }
      } else {
        showToast('Gagal memuat konten: ' + result.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error editing content:', error);
      showToast('Gagal memuat konten', 'error');
    });
}

function deleteHistoryContent(id) {
  if (!confirm('Anda yakin ingin menghapus konten ini?')) return;

  fetch(`/dashboard/skripsi/api/${id}`, {
    method: 'DELETE'
  })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        showToast('Konten berhasil dihapus', 'success');
        // Refresh history
        refreshHistory();
      } else {
        showToast('Gagal menghapus konten: ' + result.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error deleting content:', error);
      showToast('Gagal menghapus konten', 'error');
    });
}

// Auto-refresh history when content is saved
document.addEventListener('contentSaved', () => {
  refreshHistory();
});