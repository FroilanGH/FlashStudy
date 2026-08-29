  const DECKS_KEY = 'fichero_decks_v1';
  const CARDS_KEY = 'fichero_cards_v2';
  const CURRENT_DECK_KEY = 'fichero_current_deck_v1';
  const OLD_CARDS_KEY = 'fichero_flashcards_v1';
  const TASKS_KEY = 'fichero_tasks_v1';
  const EVENTS_KEY = 'fichero_events_v1';
  const FOLDERS_KEY = 'fichero_folders_v1';
  const CURRENT_FOLDER_KEY = 'fichero_current_folder_v1';

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  function readJSON(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function saveDecks(){ localStorage.setItem(DECKS_KEY, JSON.stringify(decks)); }
  function saveCards(){ localStorage.setItem(CARDS_KEY, JSON.stringify(cards)); }
  function saveCurrentDeck(){ localStorage.setItem(CURRENT_DECK_KEY, currentDeckId); }
  function saveTasks(){ localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
  function saveEvents(){ localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }
  function saveFolders(){ localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }
  function saveCurrentFolder(){ localStorage.setItem(CURRENT_FOLDER_KEY, currentFolderId); }

  // ---- Modal de confirmacion (reemplaza window.confirm, poco fiable en algunos entornos) ----
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmTitleEl = document.getElementById('confirmTitle');
  const confirmMessageEl = document.getElementById('confirmMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  let pendingConfirmAction = null;

  function showConfirm(message, onConfirm, title){
    confirmTitleEl.textContent = title || 'Confirmar';
    confirmMessageEl.textContent = message;
    pendingConfirmAction = onConfirm;
    confirmOverlay.hidden = false;
  }
  function closeConfirm(){
    confirmOverlay.hidden = true;
    pendingConfirmAction = null;
  }
  confirmCancelBtn.addEventListener('click', closeConfirm);
  confirmOverlay.addEventListener('click', (e) => { if(e.target === confirmOverlay) closeConfirm(); });
  confirmOkBtn.addEventListener('click', () => {
    const action = pendingConfirmAction;
    confirmOverlay.hidden = true;
    pendingConfirmAction = null;
    if(action) action();
  });

  // ---- Carga inicial + migración desde la versión sin mazos ----
  let decks = readJSON(DECKS_KEY);
  let cards = readJSON(CARDS_KEY);

  if(!cards){
    const oldFlat = readJSON(OLD_CARDS_KEY);
    if(Array.isArray(oldFlat) && oldFlat.length){
      const gen = { id: uid(), name: 'General' };
      decks = [gen];
      cards = oldFlat.map(c => ({ id: c.id || uid(), deckId: gen.id, q: c.q, a: c.a }));
    } else {
      cards = [];
    }
  }
  if(!decks || decks.length === 0){
    decks = [{ id: uid(), name: 'General' }];
  }
  saveDecks();
  saveCards();

  let currentDeckId = localStorage.getItem(CURRENT_DECK_KEY);
  if(!currentDeckId || !decks.find(d => d.id === currentDeckId)){
    currentDeckId = decks[0].id;
  }
  saveCurrentDeck();

  let tasks = readJSON(TASKS_KEY) || [];
  let events = readJSON(EVENTS_KEY) || [];

  let folders = readJSON(FOLDERS_KEY) || [];
  let currentFolderId = localStorage.getItem(CURRENT_FOLDER_KEY) || 'all';
  if(currentFolderId !== 'all' && !folders.find(f => f.id === currentFolderId)){
    currentFolderId = 'all';
  }
  saveCurrentFolder();

  function ensureAtLeastOneDeck(){
    if(decks.length === 0){
      const gen = { id: uid(), name: 'General' };
      decks = [gen];
      currentDeckId = gen.id;
      saveDecks(); saveCurrentDeck();
    }
  }

  function currentDeckCards(){
    return cards.filter(c => c.deckId === currentDeckId);
  }
  function visibleDecks(){
    return currentFolderId === 'all'
      ? decks
      : decks.filter(d => (d.folderId || null) === currentFolderId);
  }
  function currentVisibleDeck(){
    return visibleDecks().find(d => d.id === currentDeckId) || null;
  }
  function ensureDeckSelectionValidForFolder(){
    const vis = visibleDecks();
    if(vis.length === 0) return;
    if(!vis.find(d => d.id === currentDeckId)){
      currentDeckId = vis[0].id;
      saveCurrentDeck();
    }
  }
  function tiltFor(id){
    const n = Math.abs(Array.from(id).reduce((a,c)=>a+c.charCodeAt(0),0));
    return ((n % 45) - 22) / 10 + 'deg';
  }

  // ---- Navegación principal ----
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewFichero = document.getElementById('viewFichero');
  const viewTareas = document.getElementById('viewTareas');
  const viewCalendario = document.getElementById('viewCalendario');

  function switchView(view){
    viewFichero.hidden = view !== 'fichero';
    viewTareas.hidden = view !== 'tareas';
    viewCalendario.hidden = view !== 'calendario';
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if(view === 'tareas') renderTasks();
    if(view === 'calendario'){ renderCalendar(); renderUpcoming(); }
  }
  navBtns.forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

  // ---- DOM refs (fichero) ----
  const folderTabs = document.getElementById('folderTabs');
  const deckTabs = document.getElementById('deckTabs');
  const deckPrevBtn = document.getElementById('deckPrevBtn');
  const deckNextBtn = document.getElementById('deckNextBtn');
  const deckPageLabel = document.getElementById('deckPageLabel');
  const DECK_PAGE_SIZE = 6;
  let currentDeckPage = 0;
  const grid = document.getElementById('grid');
  const presentBtn = document.getElementById('presentBtn');

  const overlay = document.getElementById('overlay');
  const openModalBtn = document.getElementById('openModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const cardForm = document.getElementById('cardForm');
  const qInput = document.getElementById('qInput');
  const aInput = document.getElementById('aInput');

  const deckOverlay = document.getElementById('deckOverlay');
  const deckForm = document.getElementById('deckForm');
  const deckNameInput = document.getElementById('deckNameInput');
  const deckCancelBtn = document.getElementById('deckCancelBtn');

  // ---- Render principal (fichero) ----
  function render(){
    renderFolderTabs();
    ensureDeckSelectionValidForFolder();
    renderDeckTabs();
    renderGrid();
    const hasDeck = !!currentVisibleDeck();
    presentBtn.disabled = !hasDeck || currentDeckCards().length === 0;
    openModalBtn.disabled = !hasDeck;
    exportDeckBtn.disabled = !hasDeck;
  }

  function startInlineRename(tab, nameSpan, getName, setName, onSaved){
    tab.classList.add('editing');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-rename-input';
    input.value = getName();
    input.style.width = Math.max(6, getName().length + 2) + 'ch';
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function finish(shouldSave){
      if(done) return;
      done = true;
      const newName = input.value.trim();
      if(shouldSave && newName && newName !== getName()){
        setName(newName);
        onSaved();
      }
      render();
    }

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); finish(true); }
      else if(e.key === 'Escape'){ e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  function renderFolderTabs(){
    folderTabs.innerHTML = '';
    let folderClickTimer = null;

    const allTab = document.createElement('div');
    allTab.className = 'folder-tab' + (currentFolderId === 'all' ? ' active' : '');
    allTab.tabIndex = 0;
    allTab.setAttribute('role', 'button');
    allTab.textContent = 'Todos los mazos';
    allTab.addEventListener('click', () => {
      currentFolderId = 'all';
      currentDeckPage = 0;
      saveCurrentFolder();
      render();
    });
    folderTabs.appendChild(allTab);

    folders.forEach(f => {
      const tab = document.createElement('div');
      tab.className = 'folder-tab' + (currentFolderId === f.id ? ' active' : '');
      tab.tabIndex = 0;
      tab.setAttribute('role', 'button');
      tab.addEventListener('click', () => {
        if(tab.classList.contains('editing')) return;
        clearTimeout(folderClickTimer);
        folderClickTimer = setTimeout(() => {
          currentFolderId = f.id;
          currentDeckPage = 0;
          saveCurrentFolder();
          render();
        }, 220);
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.innerHTML = `&#128193; ${escapeHtml(f.name)}`;
      nameSpan.title = 'Doble clic para renombrar';
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        clearTimeout(folderClickTimer);
        startInlineRename(
          tab, nameSpan,
          () => f.name,
          (newName) => { f.name = newName; },
          () => saveFolders()
        );
      });
      tab.appendChild(nameSpan);

      const del = document.createElement('button');
      del.className = 'folder-del';
      del.type = 'button';
      del.innerHTML = '&times;';
      del.setAttribute('aria-label', 'Eliminar carpeta ' + f.name);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const affected = decks.filter(d => (d.folderId || null) === f.id).length;
        showConfirm(`Esto va a borrar la carpeta "${f.name}". Sus ${affected} mazo(s) no se borran, quedan sin carpeta.`, () => {
          folders = folders.filter(x => x.id !== f.id);
          decks.forEach(d => { if((d.folderId || null) === f.id) d.folderId = null; });
          if(currentFolderId === f.id){
            currentFolderId = 'all';
            currentDeckPage = 0;
            saveCurrentFolder();
          }
          saveFolders();
          saveDecks();
          render();
        }, 'Eliminar carpeta');
      });
      tab.appendChild(del);
      folderTabs.appendChild(tab);
    });

    const addTab = document.createElement('button');
    addTab.className = 'folder-tab folder-tab-add';
    addTab.type = 'button';
    addTab.textContent = '+ Carpeta';
    addTab.addEventListener('click', () => openFolderModal());
    folderTabs.appendChild(addTab);
  }

  function renderDeckTabs(){
    deckTabs.innerHTML = '';
    const vis = visibleDecks();
    const totalPages = Math.max(1, Math.ceil(vis.length / DECK_PAGE_SIZE));
    if(currentDeckPage >= totalPages) currentDeckPage = totalPages - 1;
    if(currentDeckPage < 0) currentDeckPage = 0;
    const pageStart = currentDeckPage * DECK_PAGE_SIZE;
    const pageDecks = vis.slice(pageStart, pageStart + DECK_PAGE_SIZE);
    let deckClickTimer = null;

    pageDecks.forEach(d => {
      const count = cards.filter(c => c.deckId === d.id).length;
      const tab = document.createElement('div');
      tab.className = 'deck-tab' + (d.id === currentDeckId ? ' active' : '');
      tab.tabIndex = 0;
      tab.setAttribute('role', 'button');
      tab.addEventListener('click', () => {
        if(tab.classList.contains('editing')) return;
        clearTimeout(deckClickTimer);
        deckClickTimer = setTimeout(() => {
          currentDeckId = d.id;
          saveCurrentDeck();
          render();
        }, 220);
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = d.name;
      nameSpan.title = 'Doble clic para renombrar';
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        clearTimeout(deckClickTimer);
        startInlineRename(
          tab, nameSpan,
          () => d.name,
          (newName) => { d.name = newName; },
          () => saveDecks()
        );
      });
      tab.appendChild(nameSpan);

      const countSpan = document.createElement('span');
      countSpan.className = 'count';
      countSpan.textContent = count;
      tab.appendChild(countSpan);

      if(folders.length > 0){
        const moveBtn = document.createElement('button');
        moveBtn.className = 'deck-del';
        moveBtn.type = 'button';
        moveBtn.innerHTML = '&#128193;';
        moveBtn.setAttribute('aria-label', 'Mover mazo ' + d.name + ' a otra carpeta');
        moveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openMoveDeckModal(d.id);
        });
        tab.appendChild(moveBtn);
      }

      const del = document.createElement('button');
      del.className = 'deck-del';
      del.type = 'button';
      del.innerHTML = '&times;';
      del.setAttribute('aria-label', 'Eliminar mazo ' + d.name);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirm(`Esto va a borrar el mazo "${d.name}" y sus ${count} tarjeta(s). Esta acción no se puede deshacer.`, () => {
          decks = decks.filter(x => x.id !== d.id);
          cards = cards.filter(c => c.deckId !== d.id);
          if(currentDeckId === d.id){
            ensureAtLeastOneDeck();
            ensureDeckSelectionValidForFolder();
          }
          saveDecks(); saveCards();
          render();
        }, 'Eliminar mazo');
      });
      tab.appendChild(del);
      deckTabs.appendChild(tab);
    });

    const addTab = document.createElement('button');
    addTab.className = 'deck-tab deck-tab-add';
    addTab.type = 'button';
    addTab.textContent = '+ Mazo';
    addTab.addEventListener('click', () => openDeckModal());
    deckTabs.appendChild(addTab);

    deckPrevBtn.disabled = currentDeckPage <= 0;
    deckNextBtn.disabled = currentDeckPage >= totalPages - 1;
    deckPageLabel.textContent = totalPages > 1 ? (currentDeckPage + 1) + ' / ' + totalPages : '';
    // display:none (no visibility:hidden) para que no reserven espacio y no
    // recorten la ultima pestaña de mazo cuando no hace falta paginar.
    deckPrevBtn.style.display = totalPages > 1 ? '' : 'none';
    deckNextBtn.style.display = totalPages > 1 ? '' : 'none';
  }

  deckPrevBtn.addEventListener('click', () => { currentDeckPage--; renderDeckTabs(); });
  deckNextBtn.addEventListener('click', () => { currentDeckPage++; renderDeckTabs(); });

  function renderGrid(){
    grid.innerHTML = '';

    if(!currentVisibleDeck()){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = 'Esta carpeta no tiene mazos todavía. Creá uno con "+ Mazo".';
      grid.appendChild(empty);
      return;
    }

    const list = currentDeckCards();

    if(list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = 'Este mazo está vacío. Agregá tu primera tarjeta.';
      grid.appendChild(empty);
    } else {
      list.forEach(c => grid.appendChild(buildCard(c)));
    }

    const tile = document.createElement('button');
    tile.className = 'new-tile';
    tile.type = 'button';
    tile.innerHTML = '<span class="plus">+</span><span>Nueva tarjeta</span>';
    tile.addEventListener('click', () => openModal());
    grid.appendChild(tile);
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function buildCard(c){
    const slot = document.createElement('div');
    slot.className = 'card-slot';

    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.style.setProperty('--tilt', tiltFor(c.id));
    card.setAttribute('role','button');
    card.setAttribute('aria-label','Tarjeta de estudio, clic para dar vuelta');

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const front = document.createElement('div');
    front.className = 'face face-front';
    front.innerHTML = `<div class="face-label">Pregunta</div><div class="face-text"></div><div class="face-hint">clic para ver la respuesta</div>`;
    front.querySelector('.face-text').textContent = c.q;

    const back = document.createElement('div');
    back.className = 'face face-back';
    back.innerHTML = `<div class="face-label">Respuesta</div><div class="face-text"></div><div class="face-hint">clic para volver</div>`;
    back.querySelector('.face-text').textContent = c.a;

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    const flip = () => card.classList.toggle('flipped');
    card.addEventListener('click', flip);
    card.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); flip(); }
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.type = 'button';
    editBtn.innerHTML = '&#9998;';
    editBtn.setAttribute('aria-label','Editar tarjeta');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(c);
    });

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.innerHTML = '&times;';
    del.setAttribute('aria-label','Eliminar tarjeta');
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      cards = cards.filter(x => x.id !== c.id);
      saveCards();
      render();
    });

    slot.appendChild(card);
    slot.appendChild(editBtn);
    slot.appendChild(del);
    return slot;
  }

  // ---- Modal: nueva tarjeta / editar tarjeta ----
  const modalTitleEl = document.getElementById('modalTitle');
  const cardSubmitBtn = document.getElementById('cardSubmitBtn');
  let editingCardId = null;

  function openModal(cardToEdit){
    editingCardId = cardToEdit ? cardToEdit.id : null;
    modalTitleEl.textContent = cardToEdit ? 'Editar tarjeta' : 'Nueva tarjeta';
    cardSubmitBtn.textContent = cardToEdit ? 'Guardar cambios' : 'Guardar';
    overlay.hidden = false;
    qInput.value = cardToEdit ? cardToEdit.q : '';
    aInput.value = cardToEdit ? cardToEdit.a : '';
    setTimeout(()=>qInput.focus(), 30);
  }
  function closeModal(){ overlay.hidden = true; }

  openModalBtn.addEventListener('click', () => openModal());
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });

  function submitCardForm(){
    const q = qInput.value.trim();
    const a = aInput.value.trim();
    if(!q || !a) return;
    if(editingCardId){
      const c = cards.find(x => x.id === editingCardId);
      if(c){ c.q = q; c.a = a; }
    } else {
      cards.push({ id: uid(), deckId: currentDeckId, q, a });
    }
    saveCards();
    closeModal();
    render();
  }
  cardSubmitBtn.addEventListener('click', submitCardForm);
  cardForm.addEventListener('submit', (e) => { e.preventDefault(); submitCardForm(); });

  // ---- Modal: nuevo mazo / renombrar mazo ----
  const deckModalTitle = document.getElementById('deckModalTitle');
  let renamingDeckId = null;

  function openDeckModal(deckToEdit){
    renamingDeckId = deckToEdit ? deckToEdit.id : null;
    deckModalTitle.textContent = deckToEdit ? 'Renombrar mazo' : 'Nuevo mazo';
    document.getElementById('deckCreateBtn').textContent = deckToEdit ? 'Guardar' : 'Crear';
    deckOverlay.hidden = false;
    deckNameInput.value = deckToEdit ? deckToEdit.name : '';
    setTimeout(() => { deckNameInput.focus(); deckNameInput.select(); }, 30);
  }
  function closeDeckModal(){ deckOverlay.hidden = true; }

  const deckCreateBtn = document.getElementById('deckCreateBtn');

  deckCancelBtn.addEventListener('click', closeDeckModal);
  deckOverlay.addEventListener('click', (e) => { if(e.target === deckOverlay) closeDeckModal(); });

  function submitDeckForm(){
    const name = deckNameInput.value.trim();
    if(!name) return;

    if(renamingDeckId){
      const d = decks.find(x => x.id === renamingDeckId);
      if(d) d.name = name;
      saveDecks();
      closeDeckModal();
      render();
      return;
    }

    const d = { id: uid(), name, folderId: currentFolderId === 'all' ? null : currentFolderId };
    decks.push(d);
    saveDecks();
    currentDeckId = d.id;
    saveCurrentDeck();
    const visCount = visibleDecks().length;
    currentDeckPage = Math.max(0, Math.ceil(visCount / DECK_PAGE_SIZE) - 1);
    closeDeckModal();
    render();
  }
  deckCreateBtn.addEventListener('click', submitDeckForm);
  deckForm.addEventListener('submit', (e) => { e.preventDefault(); submitDeckForm(); });
  deckNameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); submitDeckForm(); }
  });

  // ---- Modal: nueva carpeta ----
  const folderOverlay = document.getElementById('folderOverlay');
  const folderForm = document.getElementById('folderForm');
  const folderNameInput = document.getElementById('folderNameInput');
  const folderCancelBtn = document.getElementById('folderCancelBtn');

  const folderModalTitle = document.getElementById('folderModalTitle');
  let renamingFolderId = null;

  function openFolderModal(folderToEdit){
    renamingFolderId = folderToEdit ? folderToEdit.id : null;
    folderModalTitle.textContent = folderToEdit ? 'Renombrar carpeta' : 'Nueva carpeta';
    document.getElementById('folderCreateBtn').textContent = folderToEdit ? 'Guardar' : 'Crear';
    folderOverlay.hidden = false;
    folderNameInput.value = folderToEdit ? folderToEdit.name : '';
    setTimeout(() => { folderNameInput.focus(); folderNameInput.select(); }, 30);
  }
  function closeFolderModal(){ folderOverlay.hidden = true; }

  const folderCreateBtn = document.getElementById('folderCreateBtn');

  folderCancelBtn.addEventListener('click', closeFolderModal);
  folderOverlay.addEventListener('click', (e) => { if(e.target === folderOverlay) closeFolderModal(); });

  function submitFolderForm(){
    const name = folderNameInput.value.trim();
    if(!name) return;

    if(renamingFolderId){
      const f = folders.find(x => x.id === renamingFolderId);
      if(f) f.name = name;
      saveFolders();
      closeFolderModal();
      render();
      return;
    }

    const f = { id: uid(), name };
    folders.push(f);
    saveFolders();
    currentFolderId = f.id;
    currentDeckPage = 0;
    saveCurrentFolder();
    closeFolderModal();
    render();
  }
  folderCreateBtn.addEventListener('click', submitFolderForm);
  folderForm.addEventListener('submit', (e) => { e.preventDefault(); submitFolderForm(); });
  folderNameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); submitFolderForm(); }
  });

  // ---- Modal: mover mazo a otra carpeta ----
  const moveDeckOverlay = document.getElementById('moveDeckOverlay');
  const moveDeckModalTitle = document.getElementById('moveDeckModalTitle');
  const moveDeckOptions = document.getElementById('moveDeckOptions');
  const moveDeckCloseBtn = document.getElementById('moveDeckCloseBtn');
  let movingDeckId = null;

  function buildMoveOption(label, active, onClick){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-option' + (active ? ' active' : '');
    btn.innerHTML = `<span>${escapeHtml(label)}</span><span class="preset-check">&#10003;</span>`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderMoveDeckOptions(){
    moveDeckOptions.innerHTML = '';
    const deck = decks.find(d => d.id === movingDeckId);
    if(!deck) return;

    moveDeckOptions.appendChild(buildMoveOption('Sin carpeta', !deck.folderId, () => {
      deck.folderId = null;
      saveDecks();
      closeMoveDeckModal();
      render();
    }));

    folders.forEach(f => {
      moveDeckOptions.appendChild(buildMoveOption(f.name, deck.folderId === f.id, () => {
        deck.folderId = f.id;
        saveDecks();
        closeMoveDeckModal();
        render();
      }));
    });
  }

  function openMoveDeckModal(deckId){
    movingDeckId = deckId;
    const deck = decks.find(d => d.id === deckId);
    moveDeckModalTitle.textContent = 'Mover "' + (deck ? deck.name : '') + '"';
    renderMoveDeckOptions();
    moveDeckOverlay.hidden = false;
  }
  function closeMoveDeckModal(){ moveDeckOverlay.hidden = true; }

  moveDeckCloseBtn.addEventListener('click', closeMoveDeckModal);
  moveDeckOverlay.addEventListener('click', (e) => { if(e.target === moveDeckOverlay) closeMoveDeckModal(); });

  // ---- Exportar / Importar mazos ----
  function slugify(name){
    return (name || 'mazo')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'mazo';
  }

  function uniqueDeckName(base){
    let name = base && base.trim() ? base.trim() : 'Mazo importado';
    let i = 2;
    while(decks.some(d => d.name === name)){
      name = base + ' (' + i + ')';
      i++;
    }
    return name;
  }

  const exportDeckBtn = document.getElementById('exportDeckBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const exportOverlay = document.getElementById('exportOverlay');
  const exportTextarea = document.getElementById('exportTextarea');
  const exportCloseBtn = document.getElementById('exportCloseBtn');
  const exportCopyBtn = document.getElementById('exportCopyBtn');
  const exportDownloadBtn = document.getElementById('exportDownloadBtn');
  let currentExportFilename = 'fichero.json';

  function openExportModal(payload, filename){
    currentExportFilename = filename;
    exportTextarea.value = JSON.stringify(payload, null, 2);
    exportOverlay.hidden = false;
    exportCopyBtn.textContent = 'Copiar';
    setTimeout(() => { exportTextarea.focus(); exportTextarea.select(); }, 30);
  }
  function closeExportModal(){ exportOverlay.hidden = true; }

  exportDeckBtn.addEventListener('click', () => {
    const deck = decks.find(d => d.id === currentDeckId);
    if(!deck) return;
    const payload = {
      tipo: 'fichero-mazo',
      version: 1,
      name: deck.name,
      cards: currentDeckCards().map(c => ({ q: c.q, a: c.a }))
    };
    openExportModal(payload, `mazo-${slugify(deck.name)}.json`);
  });

  exportAllBtn.addEventListener('click', () => {
    const payload = {
      tipo: 'fichero-backup',
      version: 1,
      decks: decks.map(d => ({
        name: d.name,
        cards: cards.filter(c => c.deckId === d.id).map(c => ({ q: c.q, a: c.a }))
      }))
    };
    openExportModal(payload, 'fichero-backup.json');
  });

  exportCloseBtn.addEventListener('click', closeExportModal);
  exportOverlay.addEventListener('click', (e) => { if(e.target === exportOverlay) closeExportModal(); });

  exportCopyBtn.addEventListener('click', () => {
    exportTextarea.focus();
    exportTextarea.select();
    let copied = false;
    try{ copied = document.execCommand('copy'); }catch(e){ copied = false; }
    if(copied){
      exportCopyBtn.textContent = '¡Copiado!';
      setTimeout(() => { exportCopyBtn.textContent = 'Copiar'; }, 1500);
    } else if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(exportTextarea.value).then(() => {
        exportCopyBtn.textContent = '¡Copiado!';
        setTimeout(() => { exportCopyBtn.textContent = 'Copiar'; }, 1500);
      }).catch(() => {
        alert('No pude copiar automáticamente. Seleccioná el texto y copialo con Ctrl+C.');
      });
    } else {
      alert('No pude copiar automáticamente. Seleccioná el texto y copialo con Ctrl+C.');
    }
  });

  exportDownloadBtn.addEventListener('click', () => {
    try{
      const blob = new Blob([exportTextarea.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentExportFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }catch(e){
      alert('La descarga automática no está disponible acá. Usá "Copiar" y pegalo en un archivo .json.');
    }
  });

  const importBtn = document.getElementById('importBtn');
  const importOverlay = document.getElementById('importOverlay');
  const importFileBtn = document.getElementById('importFileBtn');
  const importFileInput = document.getElementById('importFileInput');
  const importTextarea = document.getElementById('importTextarea');
  const importCancelBtn = document.getElementById('importCancelBtn');
  const importTextBtn = document.getElementById('importTextBtn');

  function openImportModal(){
    importTextarea.value = '';
    importOverlay.hidden = false;
    setTimeout(() => importTextarea.focus(), 30);
  }
  function closeImportModal(){ importOverlay.hidden = true; }

  importBtn.addEventListener('click', openImportModal);
  importCancelBtn.addEventListener('click', closeImportModal);
  importOverlay.addEventListener('click', (e) => { if(e.target === importOverlay) closeImportModal(); });

  importFileBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { importTextarea.value = reader.result; };
    reader.onerror = () => { alert('No pude leer ese archivo.'); };
    reader.readAsText(file, 'utf-8');
    importFileInput.value = '';
  });

  function importDeckObj(obj){
    const name = uniqueDeckName(obj && obj.name);
    const d = { id: uid(), name };
    decks.push(d);
    const rawCards = (obj && Array.isArray(obj.cards)) ? obj.cards : [];
    rawCards.forEach(c => {
      if(c && typeof c.q === 'string' && typeof c.a === 'string' && c.q.trim() && c.a.trim()){
        cards.push({ id: uid(), deckId: d.id, q: c.q, a: c.a });
      }
    });
    return d;
  }

  importTextBtn.addEventListener('click', () => {
    const raw = importTextarea.value.trim();
    if(!raw){ alert('Pegá o elegí un archivo primero.'); return; }

    let data;
    try{
      data = JSON.parse(raw);
    }catch(err){
      alert('Ese texto no es un JSON válido.');
      return;
    }

    let firstImported = null;
    try{
      if(data && data.tipo === 'fichero-mazo' && Array.isArray(data.cards)){
        firstImported = importDeckObj(data);
      } else if(data && data.tipo === 'fichero-backup' && Array.isArray(data.decks)){
        data.decks.forEach(dd => {
          const d = importDeckObj(dd);
          if(!firstImported) firstImported = d;
        });
      } else if(Array.isArray(data)){
        firstImported = importDeckObj({ name: 'Mazo importado', cards: data });
      } else {
        alert('No reconocí el formato de este contenido.');
        return;
      }
    }catch(err){
      alert('No pude importar este contenido.');
      return;
    }

    saveDecks();
    saveCards();
    if(firstImported){
      currentDeckId = firstImported.id;
      saveCurrentDeck();
    }
    closeImportModal();
    render();
  });

  // ---- Tareas ----
  const taskAddBtn = document.getElementById('taskAddBtn');
  const pendingTasksList = document.getElementById('pendingTasksList');
  const doneTasksList = document.getElementById('doneTasksList');
  const pendingEmpty = document.getElementById('pendingEmpty');
  const doneEmpty = document.getElementById('doneEmpty');

  const taskOverlay = document.getElementById('taskOverlay');
  const taskModalTitle = document.getElementById('taskModalTitle');
  const taskTitleInput = document.getElementById('taskTitleInput');
  const taskDescInput = document.getElementById('taskDescInput');
  const taskDateInput = document.getElementById('taskDateInput');
  const taskCancelBtn = document.getElementById('taskCancelBtn');
  const taskSaveBtn = document.getElementById('taskSaveBtn');
  let editingTaskId = null;

  function formatTaskDate(iso){
    const [y, m, d] = iso.split('-').map(Number);
    return d + ' de ' + MONTH_NAMES[m - 1] + (y !== new Date().getFullYear() ? ' ' + y : '');
  }

  function buildTaskItem(t){
    const li = document.createElement('li');
    li.className = 'task-item' + (t.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-checkbox';
    cb.checked = t.done;
    cb.setAttribute('aria-label', t.done ? 'Marcar como pendiente' : 'Marcar como completada');
    cb.addEventListener('change', () => {
      t.done = cb.checked;
      saveTasks();
      renderTasks();
      renderCalendar();
      renderUpcoming();
    });

    const body = document.createElement('div');
    body.className = 'task-body';

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = t.text;
    body.appendChild(span);

    if(t.description){
      const desc = document.createElement('div');
      desc.className = 'task-desc';
      desc.textContent = t.description;
      body.appendChild(desc);
    }

    if(t.dueDate){
      const due = document.createElement('div');
      const overdue = !t.done && t.dueDate < todayISO();
      due.className = 'task-due' + (overdue ? ' overdue' : '');
      due.innerHTML = '&#128197; ' + escapeHtml(formatTaskDate(t.dueDate)) + (overdue ? ' · vencida' : '');
      body.appendChild(due);
    }

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task-edit';
    editBtn.innerHTML = '&#9998;';
    editBtn.setAttribute('aria-label', 'Editar tarea');
    editBtn.addEventListener('click', () => openTaskModal(t));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'task-delete';
    del.innerHTML = '&times;';
    del.setAttribute('aria-label', 'Eliminar tarea');
    del.addEventListener('click', () => {
      showConfirm(`Esto va a borrar la tarea "${t.text}".`, () => {
        tasks = tasks.filter(x => x.id !== t.id);
        saveTasks();
        renderTasks();
        renderCalendar();
        renderUpcoming();
      }, 'Eliminar tarea');
    });

    actions.appendChild(editBtn);
    actions.appendChild(del);

    li.appendChild(cb);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function renderTasks(){
    const pending = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);
    pendingTasksList.innerHTML = '';
    doneTasksList.innerHTML = '';
    pending.forEach(t => pendingTasksList.appendChild(buildTaskItem(t)));
    done.forEach(t => doneTasksList.appendChild(buildTaskItem(t)));
    pendingEmpty.hidden = pending.length > 0;
    doneEmpty.hidden = done.length > 0;
  }

  function openTaskModal(taskToEdit){
    editingTaskId = taskToEdit ? taskToEdit.id : null;
    taskModalTitle.textContent = taskToEdit ? 'Editar tarea' : 'Nueva tarea';
    taskSaveBtn.textContent = taskToEdit ? 'Guardar cambios' : 'Guardar';
    taskTitleInput.value = taskToEdit ? taskToEdit.text : '';
    taskDescInput.value = taskToEdit ? (taskToEdit.description || '') : '';
    taskDateInput.value = taskToEdit ? (taskToEdit.dueDate || '') : '';
    taskOverlay.hidden = false;
    setTimeout(() => taskTitleInput.focus(), 30);
  }
  function closeTaskModal(){ taskOverlay.hidden = true; }

  function submitTaskForm(){
    const text = taskTitleInput.value.trim();
    if(!text) return;
    const description = taskDescInput.value.trim();
    const dueDate = taskDateInput.value || null;

    if(editingTaskId){
      const t = tasks.find(x => x.id === editingTaskId);
      if(t){ t.text = text; t.description = description; t.dueDate = dueDate; }
    } else {
      tasks.push({ id: uid(), text, description, dueDate, done: false });
    }
    saveTasks();
    closeTaskModal();
    renderTasks();
    renderCalendar();
    renderUpcoming();
  }

  taskAddBtn.addEventListener('click', () => openTaskModal());
  taskCancelBtn.addEventListener('click', closeTaskModal);
  taskSaveBtn.addEventListener('click', submitTaskForm);
  taskOverlay.addEventListener('click', (e) => { if(e.target === taskOverlay) closeTaskModal(); });
  taskTitleInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); submitTaskForm(); }
  });

  // ---- Calendario ----
  const calPrevBtn = document.getElementById('calPrevBtn');
  const calNextBtn = document.getElementById('calNextBtn');
  const calMonthLabel = document.getElementById('calMonthLabel');
  const calGrid = document.getElementById('calGrid');
  const upcomingList = document.getElementById('upcomingList');
  const upcomingEmpty = document.getElementById('upcomingEmpty');

  const dayOverlay = document.getElementById('dayOverlay');
  const dayModalTitle = document.getElementById('dayModalTitle');
  const dayEventsList = document.getElementById('dayEventsList');
  const dayEventInput = document.getElementById('dayEventInput');
  const dayAddEventBtn = document.getElementById('dayAddEventBtn');
  const dayCloseBtn = document.getElementById('dayCloseBtn');

  const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const WEEKDAY_NAMES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

  let calViewDate = new Date();
  calViewDate.setDate(1);
  let selectedDayISO = null;

  function pad2(n){ return String(n).padStart(2, '0'); }
  function isoDate(y, m, d){ return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
  function todayISO(){
    const t = new Date();
    return isoDate(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function formatDateHuman(iso){
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${WEEKDAY_NAMES[dt.getDay()]} ${d} de ${MONTH_NAMES[m - 1]} ${y}`;
  }

  // Combina eventos manuales + tareas con fecha de entrega para una fecha dada
  function eventsForDate(iso){
    const manual = events.filter(ev => ev.date === iso).map(ev => ({ kind: 'event', id: ev.id, title: ev.title }));
    const due = tasks.filter(t => t.dueDate === iso).map(t => ({ kind: 'task', id: t.id, title: t.text, done: t.done }));
    return [...manual, ...due];
  }

  function renderCalendar(){
    const y = calViewDate.getFullYear();
    const m = calViewDate.getMonth();
    calMonthLabel.textContent = MONTH_NAMES[m] + ' ' + y;
    calGrid.innerHTML = '';

    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const today = todayISO();

    for(let i = 0; i < totalCells; i++){
      const dayNum = i - firstDow + 1;
      const cell = document.createElement('div');
      cell.className = 'cal-day';

      let displayNum, otherMonth = false;
      if(dayNum < 1){
        displayNum = daysInPrevMonth + dayNum;
        otherMonth = true;
      } else if(dayNum > daysInMonth){
        displayNum = dayNum - daysInMonth;
        otherMonth = true;
      } else {
        displayNum = dayNum;
      }

      if(otherMonth){
        cell.classList.add('other-month');
        cell.textContent = displayNum;
        calGrid.appendChild(cell);
        continue;
      }

      const cellISO = isoDate(y, m, dayNum);
      if(cellISO === today) cell.classList.add('today');

      const numSpan = document.createElement('span');
      numSpan.textContent = displayNum;
      cell.appendChild(numSpan);

      const dayItems = eventsForDate(cellISO);
      if(dayItems.length > 0){
        const dotsWrap = document.createElement('span');
        dotsWrap.className = 'cal-dots';
        if(dayItems.some(it => it.kind === 'event')){
          const dot = document.createElement('span');
          dot.className = 'cal-dot';
          dotsWrap.appendChild(dot);
        }
        if(dayItems.some(it => it.kind === 'task')){
          const dot = document.createElement('span');
          dot.className = 'cal-dot cal-dot-task';
          dotsWrap.appendChild(dot);
        }
        cell.appendChild(dotsWrap);
      }

      cell.addEventListener('click', () => openDayModal(cellISO));
      calGrid.appendChild(cell);
    }
  }

  calPrevBtn.addEventListener('click', () => {
    calViewDate.setMonth(calViewDate.getMonth() - 1);
    renderCalendar();
  });
  calNextBtn.addEventListener('click', () => {
    calViewDate.setMonth(calViewDate.getMonth() + 1);
    renderCalendar();
  });

  function renderDayEvents(){
    dayEventsList.innerHTML = '';
    const items = eventsForDate(selectedDayISO);
    if(items.length === 0){
      const li = document.createElement('li');
      li.style.fontSize = '13px';
      li.style.color = 'var(--ink-soft)';
      li.textContent = 'Todavía no hay nada anotado este día.';
      dayEventsList.appendChild(li);
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'upcoming-item day-event-item';

      if(item.kind === 'task'){
        const label = document.createElement('span');
        label.className = 'upcoming-title';
        label.innerHTML = '&#9989; ' + escapeHtml(item.title) + (item.done ? ' <span style="color:var(--sage);font-weight:700;">(hecha)</span>' : '');
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'task-delete';
        clearBtn.innerHTML = '&times;';
        clearBtn.setAttribute('aria-label', 'Quitar fecha de esta tarea');
        clearBtn.title = 'Quitar la fecha (la tarea no se borra)';
        clearBtn.addEventListener('click', () => {
          const t = tasks.find(x => x.id === item.id);
          if(t) t.dueDate = null;
          saveTasks();
          renderDayEvents();
          renderTasks();
        });
        li.appendChild(label);
        li.appendChild(clearBtn);
      } else {
        const span = document.createElement('span');
        span.className = 'upcoming-title';
        span.textContent = item.title;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'task-delete';
        del.innerHTML = '&times;';
        del.setAttribute('aria-label', 'Eliminar evento');
        del.addEventListener('click', () => {
          events = events.filter(x => x.id !== item.id);
          saveEvents();
          renderDayEvents();
        });
        li.appendChild(span);
        li.appendChild(del);
      }
      dayEventsList.appendChild(li);
    });
  }

  function openDayModal(iso){
    selectedDayISO = iso;
    dayModalTitle.textContent = formatDateHuman(iso);
    dayEventInput.value = '';
    renderDayEvents();
    dayOverlay.hidden = false;
    setTimeout(() => dayEventInput.focus(), 30);
  }
  function closeDayModal(){
    dayOverlay.hidden = true;
    renderCalendar();
    renderUpcoming();
  }

  dayAddEventBtn.addEventListener('click', () => {
    const title = dayEventInput.value.trim();
    if(!title) return;
    events.push({ id: uid(), date: selectedDayISO, title });
    saveEvents();
    dayEventInput.value = '';
    renderDayEvents();
  });
  dayEventInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); dayAddEventBtn.click(); }
  });
  dayCloseBtn.addEventListener('click', closeDayModal);
  dayOverlay.addEventListener('click', (e) => { if(e.target === dayOverlay) closeDayModal(); });

  function renderUpcoming(){
    const today = todayISO();
    const manual = events.filter(ev => ev.date >= today).map(ev => ({ date: ev.date, title: ev.title, kind: 'event' }));
    const due = tasks.filter(t => t.dueDate && t.dueDate >= today && !t.done).map(t => ({ date: t.dueDate, title: t.text, kind: 'task' }));
    const upcoming = [...manual, ...due].sort((a, b) => a.date.localeCompare(b.date));

    upcomingList.innerHTML = '';
    upcomingEmpty.hidden = upcoming.length > 0;
    upcoming.slice(0, 15).forEach(item => {
      const li = document.createElement('li');
      li.className = 'upcoming-item';
      li.style.cursor = 'pointer';
      const dateDiv = document.createElement('div');
      dateDiv.className = 'upcoming-date';
      dateDiv.textContent = formatDateHuman(item.date);
      const titleDiv = document.createElement('div');
      titleDiv.className = 'upcoming-title';
      titleDiv.innerHTML = (item.kind === 'task' ? '&#9989; ' : '') + escapeHtml(item.title);
      li.appendChild(dateDiv);
      li.appendChild(titleDiv);
      li.addEventListener('click', () => openDayModal(item.date));
      upcomingList.appendChild(li);
    });
  }

  // ---- Escape cierra cualquier modal abierto ----
  document.addEventListener('keydown', (e) => {
    if(e.key !== 'Escape') return;
    if(!overlay.hidden) closeModal();
    if(!deckOverlay.hidden) closeDeckModal();
    if(!folderOverlay.hidden) closeFolderModal();
    if(!moveDeckOverlay.hidden) closeMoveDeckModal();
    if(!taskOverlay.hidden) closeTaskModal();
    if(!pomoOverlay.hidden) closePomoModal();
    if(!exportOverlay.hidden) closeExportModal();
    if(!importOverlay.hidden) closeImportModal();
    if(!dayOverlay.hidden) closeDayModal();
    if(!confirmOverlay.hidden) closeConfirm();
  });

  // ---- Modo presentación ----
  const presentOverlay = document.getElementById('presentOverlay');
  const presentExitBtn = document.getElementById('presentExitBtn');
  const presentExitBtn2 = document.getElementById('presentExitBtn2');
  const presentRestartBtn = document.getElementById('presentRestartBtn');
  const presentProgress = document.getElementById('presentProgress');
  const presentCardSlot = document.getElementById('presentCardSlot');
  const presentCard = document.getElementById('presentCard');
  const presentFrontText = document.getElementById('presentFrontText');
  const presentBackText = document.getElementById('presentBackText');
  const presentEnd = document.getElementById('presentEnd');
  const presentKbdHint = document.getElementById('presentKbdHint');

  let presentList = [];
  let presentPos = 0;
  let presentFlipped = false;

  function startPresentation(){
    presentList = currentDeckCards();
    if(presentList.length === 0) return;
    presentPos = 0;
    presentFlipped = false;
    presentOverlay.hidden = false;
    renderPresent();
    presentCard.focus();
    const el = document.documentElement;
    if(el.requestFullscreen){
      el.requestFullscreen().catch(()=>{});
    }
  }

  function exitPresentation(){
    presentOverlay.hidden = true;
    if(document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
    }
  }

  function renderPresent(){
    if(presentPos >= presentList.length){
      presentCardSlot.hidden = true;
      presentProgress.hidden = true;
      presentKbdHint.hidden = true;
      presentEnd.hidden = false;
      return;
    }
    presentCardSlot.hidden = false;
    presentProgress.hidden = false;
    presentKbdHint.hidden = false;
    presentEnd.hidden = true;

    const c = presentList[presentPos];
    presentFrontText.textContent = c.q;
    presentBackText.textContent = c.a;
    presentCard.classList.toggle('flipped', presentFlipped);
    presentProgress.textContent = (presentPos + 1) + ' / ' + presentList.length;
  }

  function presentAdvanceOrFlip(){
    if(!presentFlipped){
      presentFlipped = true;
    } else {
      presentPos++;
      presentFlipped = false;
    }
    renderPresent();
  }
  function presentGoBack(){
    if(presentPos > 0){
      presentPos--;
      presentFlipped = false;
      renderPresent();
    }
  }

  presentBtn.addEventListener('click', startPresentation);
  presentExitBtn.addEventListener('click', exitPresentation);
  presentExitBtn2.addEventListener('click', exitPresentation);
  presentRestartBtn.addEventListener('click', () => {
    presentPos = 0;
    presentFlipped = false;
    renderPresent();
  });
  presentCard.addEventListener('click', presentAdvanceOrFlip);
  presentCard.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); presentAdvanceOrFlip(); }
  });

  document.addEventListener('keydown', (e) => {
    if(presentOverlay.hidden) return;
    if(e.key === 'Escape'){ exitPresentation(); return; }
    if(presentEnd.hidden){
      if(e.key === 'ArrowRight'){ e.preventDefault(); presentAdvanceOrFlip(); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); presentGoBack(); }
      else if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); presentAdvanceOrFlip(); }
    }
  });

  // ---- Pomodoro ----
  const POMO_PRESETS = [
    { study: 30, brk: 5 },
    { study: 45, brk: 5 },
    { study: 60, brk: 10 }
  ];
  let pomoPresetIdx = 0;
  let pomoPhase = 'study';
  let pomoTotal = 0;
  let pomoRemaining = 0;
  let pomoTimerId = null;
  let pomoRunning = false;

  const pomoBtn = document.getElementById('pomoBtn');
  const pomoOverlay = document.getElementById('pomoOverlay');
  const pomoPresetsEl = document.getElementById('pomoPresets');
  const pomoCancelBtn = document.getElementById('pomoCancelBtn');
  const pomoStartBtn = document.getElementById('pomoStartBtn');
  const pomoWidget = document.getElementById('pomoWidget');
  const pomoPhaseEl = document.getElementById('pomoPhaseEl');
  const pomoTimeEl = document.getElementById('pomoTimeEl');
  const pomoBarFill = document.getElementById('pomoBarFill');
  const pomoPauseBtn = document.getElementById('pomoPauseBtn');
  const pomoResetBtn = document.getElementById('pomoResetBtn');
  const pomoStopBtn = document.getElementById('pomoStopBtn');

  function renderPomoPresets(){
    pomoPresetsEl.innerHTML = '';
    POMO_PRESETS.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-option' + (idx === pomoPresetIdx ? ' active' : '');
      btn.innerHTML = `<span>${p.study} min estudio / ${p.brk} min descanso</span><span class="preset-check">&#10003;</span>`;
      btn.addEventListener('click', () => {
        pomoPresetIdx = idx;
        renderPomoPresets();
      });
      pomoPresetsEl.appendChild(btn);
    });
  }

  function openPomoModal(){
    pomoOverlay.hidden = false;
    renderPomoPresets();
  }
  function closePomoModal(){ pomoOverlay.hidden = true; }

  pomoBtn.addEventListener('click', openPomoModal);
  pomoCancelBtn.addEventListener('click', closePomoModal);
  pomoOverlay.addEventListener('click', (e) => { if(e.target === pomoOverlay) closePomoModal(); });

  function beep(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, delay) => {
        setTimeout(() => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
          o.start();
          o.stop(ctx.currentTime + 0.55);
        }, delay);
      };
      playTone(880, 0);
      playTone(1046, 250);
    }catch(e){}
  }

  function formatTime(sec){
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return mm + ':' + ss;
  }

  function updatePomoWidget(){
    pomoWidget.classList.toggle('break', pomoPhase === 'break');
    pomoPhaseEl.textContent = pomoPhase === 'study' ? 'Estudio' : 'Descanso';
    pomoTimeEl.textContent = formatTime(pomoRemaining);
    const pct = pomoTotal > 0 ? (pomoRemaining / pomoTotal * 100) : 0;
    pomoBarFill.style.width = pct + '%';
    pomoPauseBtn.textContent = pomoRunning ? 'Pausar' : 'Reanudar';
  }

  function pomoTick(){
    pomoRemaining--;
    if(pomoRemaining <= 0){
      beep();
      pomoPhase = pomoPhase === 'study' ? 'break' : 'study';
      const p = POMO_PRESETS[pomoPresetIdx];
      pomoTotal = (pomoPhase === 'study' ? p.study : p.brk) * 60;
      pomoRemaining = pomoTotal;
    }
    updatePomoWidget();
  }

  function startPomodoro(){
    const p = POMO_PRESETS[pomoPresetIdx];
    pomoPhase = 'study';
    pomoTotal = p.study * 60;
    pomoRemaining = pomoTotal;
    pomoRunning = true;
    if(pomoTimerId) clearInterval(pomoTimerId);
    pomoTimerId = setInterval(pomoTick, 1000);
    pomoWidget.hidden = false;
    updatePomoWidget();
  }

  function stopPomodoro(){
    if(pomoTimerId) clearInterval(pomoTimerId);
    pomoTimerId = null;
    pomoRunning = false;
    pomoWidget.hidden = true;
  }

  pomoStartBtn.addEventListener('click', () => {
    closePomoModal();
    startPomodoro();
  });

  pomoPauseBtn.addEventListener('click', () => {
    if(pomoRunning){
      clearInterval(pomoTimerId);
      pomoTimerId = null;
      pomoRunning = false;
    } else {
      pomoTimerId = setInterval(pomoTick, 1000);
      pomoRunning = true;
    }
    updatePomoWidget();
  });

  pomoResetBtn.addEventListener('click', () => {
    pomoRemaining = pomoTotal;
    updatePomoWidget();
  });

  pomoStopBtn.addEventListener('click', stopPomodoro);

  render();
