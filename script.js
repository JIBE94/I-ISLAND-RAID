/* =========================================================
   I-ISLAND — SUPABASE VERSION
   Visiteur / Staff / Admin
   Protection : 21h Paris du 3e jour calendaire
   ========================================================= */

const SUPABASE_URL = 'https://wfjftrnetjqmyfymhher.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_GQWJIHnHimkLIHcwir68UQ_PIoTD3Bk';

const FACTIONS = [
  'Héros',
  'Yakuza',
  'Yamaguchi',
  'Unbound',
  'Breakout',
  'Umbra',
  'Triades'
];

const ZONES = [
  {
    id: 'laboratoire',
    name: 'LABORATOIRE',
    num: '01',
    image: 'assets/laboratoire.jpg'
  },
  {
    id: 'dojo',
    name: 'DOJO',
    num: '02',
    image: 'assets/dojo.jpg'
  },
  {
    id: 'casse',
    name: 'CASSE',
    num: '03',
    image: 'assets/casse.jpg'
  },
  {
    id: 'maison-hantee',
    name: 'MAISON HANTE',
    num: '04',
    image: 'assets/maison-hantee.jpg'
  }
];

let supabase;
let currentUser = null;
let currentProfile = null;
let selectedFaction = null;
let raidTarget = null;
let territories = [];
let profiles = [];

/* =========================================================
   OUTILS
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message) {
  const toast = document.getElementById('toast');

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function formatDate(date) {
  if (!date) return '';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris'
  }).format(new Date(date));
}

function formatCountdown(milliseconds) {
  if (milliseconds <= 0) return 'RAID POSSIBLE';

  const totalSeconds = Math.floor(milliseconds / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}j ${String(hours).padStart(2, '0')}h ${String(
    minutes
  ).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function isProtected(zone) {
  if (!zone?.protection_until) return false;

  return new Date(zone.protection_until).getTime() > Date.now();
}

function isStaff() {
  return (
    currentProfile &&
    ['staff', 'admin'].includes(currentProfile.role)
  );
}

function isAdmin() {
  return currentProfile?.role === 'admin';
}

/* =========================================================
   CHARGEMENT SUPABASE
   ========================================================= */

function loadSupabaseLibrary() {
  if (window.supabase) {
    return Promise.resolve();
  }

  if (loadSupabaseLibrary.promise) {
    return loadSupabaseLibrary.promise;
  }

  loadSupabaseLibrary.promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src =
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

    script.onload = resolve;

    script.onerror = () =>
      reject(new Error('Impossible de charger Supabase.'));

    document.head.appendChild(script);
  });

  return loadSupabaseLibrary.promise;
}

/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function loadCurrentUser() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  currentUser = user || null;

  if (!currentUser) {
    currentProfile = null;
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    currentProfile = null;
    return;
  }

  currentProfile = data;
}

async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showToast(`Connexion refusée : ${error.message}`);
    return;
  }

  showToast('Connexion réussie.');

  await loadCurrentUser();
  renderAuthArea();
  renderTerritories();
}

async function logout() {
  await supabase.auth.signOut();

  currentUser = null;
  currentProfile = null;

  renderAuthArea();
  renderTerritories();

  showToast('Déconnexion effectuée.');
}

/* =========================================================
   INTERFACE CONNEXION
   ========================================================= */

function injectAuthInterface() {
  const topbar = document.querySelector('.topbar');

  if (!topbar || document.getElementById('islandAuth')) return;

  const auth = document.createElement('div');

  auth.id = 'islandAuth';

  auth.style.cssText = `
    display:flex;
    align-items:center;
    gap:8px;
    margin-left:auto;
    margin-right:20px;
    font-family:Inter, sans-serif;
  `;

  topbar.appendChild(auth);

  renderAuthArea();
}

function renderAuthArea() {
  const auth = document.getElementById('islandAuth');

  if (!auth) return;

  if (!currentUser) {
    auth.innerHTML = `
      <button
        id="loginButton"
        class="ghost"
        style="padding:9px 12px;"
      >
        CONNEXION
      </button>
    `;

    document.getElementById('loginButton').onclick =
      openLoginModal;

    return;
  }

  const roleLabel =
    currentProfile?.role === 'admin'
      ? '👑 ADMIN'
      : currentProfile?.role === 'staff'
        ? '🛡️ STAFF'
        : '👁️ VISITEUR';

  auth.innerHTML = `
    <span style="
      color:#8f99a6;
      font-size:9px;
      letter-spacing:.08em;
      font-weight:800;
    ">
      ${escapeHtml(roleLabel)}
    </span>

    ${
      isAdmin()
        ? `
          <button
            id="adminButton"
            class="ghost"
            style="padding:9px 12px;"
          >
            ADMIN
          </button>
        `
        : ''
    }

    <button
      id="logoutButton"
      class="ghost"
      style="padding:9px 12px;"
    >
      DÉCONNEXION
    </button>
  `;

  const logoutButton =
    document.getElementById('logoutButton');

  if (logoutButton) {
    logoutButton.onclick = logout;
  }

  const adminButton =
    document.getElementById('adminButton');

  if (adminButton) {
    adminButton.onclick = openAdminPanel;
  }
}

/* =========================================================
   MODAL LOGIN
   ========================================================= */

function openLoginModal() {
  const modal = document.createElement('div');

  modal.id = 'loginModal';

  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-card">

      <button
        class="close"
        id="closeLogin"
        aria-label="Fermer"
      >
        ×
      </button>

      <p class="eyebrow">AUTH / I-ISLAND</p>

      <div class="modal-signal">
        <span></span> SECURE LOGIN
      </div>

      <h2>CONNEXION</h2>

      <p>
        Connecte-toi pour accéder aux fonctions
        correspondant à ton rôle.
      </p>

      <label style="
        display:block;
        margin-top:20px;
        color:#727c89;
        font:800 8px Orbitron;
        letter-spacing:.12em;
      ">
        EMAIL
      </label>

      <input
        id="loginEmail"
        type="email"
        autocomplete="email"
        placeholder="ton@email.com"
        style="
          width:100%;
          margin-top:7px;
          padding:13px;
          background:#080c11;
          border:1px solid #303945;
          color:white;
          outline:none;
        "
      >

      <label style="
        display:block;
        margin-top:16px;
        color:#727c89;
        font:800 8px Orbitron;
        letter-spacing:.12em;
      ">
        MOT DE PASSE
      </label>

      <input
        id="loginPassword"
        type="password"
        autocomplete="current-password"
        placeholder="••••••••"
        style="
          width:100%;
          margin-top:7px;
          padding:13px;
          background:#080c11;
          border:1px solid #303945;
          color:white;
          outline:none;
        "
      >

      <div class="modal-actions">
        <button
          class="ghost"
          id="cancelLogin"
        >
          ANNULER
        </button>

        <button
          class="danger"
          id="confirmLogin"
        >
          SE CONNECTER
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('closeLogin').onclick =
    () => modal.remove();

  document.getElementById('cancelLogin').onclick =
    () => modal.remove();

  document.getElementById('confirmLogin').onclick =
    async () => {
      const email =
        document.getElementById('loginEmail').value.trim();

      const password =
        document.getElementById('loginPassword').value;

      if (!email || !password) {
        showToast('Email et mot de passe obligatoires.');
        return;
      }

      await login(email, password);

      if (currentUser) {
        modal.remove();
      }
    };

  document.getElementById('loginPassword').addEventListener(
    'keydown',
    event => {
      if (event.key === 'Enter') {
        document.getElementById('confirmLogin').click();
      }
    }
  );
}

/* =========================================================
   CHARGEMENT DES TERRITOIRES
   ========================================================= */

async function loadTerritories() {
  const { data, error } = await supabase
    .from('territories')
    .select(`
      id,
      slug,
      name,
      image_path,
      current_holder,
      assigned_at,
      protection_until,
      updated_at,
      holder_history (
        id,
        holder_name,
        held_from,
        held_until
      )
    `)
    .order('slug');

  if (error) {
    console.error(error);
    showToast('Impossible de charger les territoires.');
    return;
  }

  territories = data || [];

  renderTerritories();
}

/* =========================================================
   ORGANISATIONS
   ========================================================= */

function renderTicker() {
  const ticker = document.getElementById('ticker');

  if (!ticker) return;

  ticker.innerHTML = FACTIONS.map(
    faction => `
      <button
        class="faction ${
          selectedFaction === faction ? 'active' : ''
        }"
        data-faction="${escapeHtml(faction)}"
      >
        ${escapeHtml(faction)}
      </button>
    `
  ).join('');

  ticker.querySelectorAll('.faction').forEach(button => {
    button.onclick = () => {
      selectedFaction = button.dataset.faction;

      document.getElementById('selectedFaction').textContent =
        selectedFaction.toUpperCase();

      renderTicker();
      renderTerritories();
    };
  });
}

/* =========================================================
   TERRITOIRES
   ========================================================= */

function renderTerritories() {
  const container =
    document.getElementById('territories');

  if (!container) return;

  container.innerHTML = territories
    .map(zone => {
      const zoneConfig =
        ZONES.find(z => z.id === zone.slug) || {};

      const protectedZone = isProtected(zone);

      const history =
        zone.holder_history || [];

      const canRaid =
        Boolean(selectedFaction) &&
        isStaff() &&
        !protectedZone;

      return `
        <article class="territory">

          <div
            class="territory-art"
            style="
              --image:url('${escapeHtml(
                zoneConfig.image || zone.image_path || ''
              )}')
            "
          ></div>

          <div class="status-badge ${
            protectedZone ? 'protected' : 'free'
          }">
            ${
              protectedZone
                ? 'SOUS PROTECTION'
                : 'RAID POSSIBLE'
            }
          </div>

          <div class="territory-content">

            <div class="territory-number">
              SECTEUR ${escapeHtml(zoneConfig.num || '')}
            </div>

            <h3>
              ${escapeHtml(zone.name)}
            </h3>

            <div>
              <div class="owner-label">
                DÉTENTEUR ACTUEL
              </div>

              <div class="${
                zone.current_holder
                  ? 'owner'
                  : 'owner empty-owner'
              }">
                ${
                  zone.current_holder
                    ? escapeHtml(zone.current_holder)
                    : 'AUCUN DÉTENTEUR'
                }
              </div>
            </div>

            <div class="territory-bottom">

              <div class="protection">

                <div class="protection-label">
                  ${
                    protectedZone
                      ? 'PROTECTION RESTANTE'
                      : 'STATUT'
                  }
                </div>

                <div
                  class="countdown"
                  data-expiry="${
                    zone.protection_until || ''
                  }"
                >
                  ${
                    protectedZone
                      ? formatCountdown(
                          new Date(
                            zone.protection_until
                          ).getTime() - Date.now()
                        )
                      : 'RAID POSSIBLE'
                  }
                </div>

              </div>

              ${
                isStaff()
                  ? `
                    <button
                      class="danger raid-btn"
                      data-raid="${escapeHtml(zone.id)}"
                      ${canRaid ? '' : 'disabled'}
                    >
                      ${
                        protectedZone
                          ? 'PROTÉGÉ'
                          : selectedFaction
                            ? 'RAID'
                            : 'CHOISIS UN CAMP'
                      }
                    </button>
                  `
                  : `
                    <div style="
                      color:#596472;
                      font-size:8px;
                      letter-spacing:.12em;
                      font-weight:800;
                    ">
                      ${
                        currentUser
                          ? 'VISITEUR — CONSULTATION'
                          : 'CONNECTE-TOI POUR RAID'
                      }
                    </div>
                  `
              }

            </div>

            <div class="history">

              <div class="history-title">
                ANCIENS DÉTENTEURS
              </div>

              <div class="history-list">

                ${
                  history.length
                    ? history
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.held_until) -
                            new Date(a.held_until)
                        )
                        .map(
                          item => `
                            <span
                              class="history-item"
                              title="${escapeHtml(
                                formatDate(item.held_until)
                              )}"
                            >
                              ${escapeHtml(
                                item.holder_name
                              )}
                            </span>
                          `
                        )
                        .join('')
                    : `
                      <span class="history-item">
                        AUCUN HISTORIQUE
                      </span>
                    `
                }

              </div>

            </div>

          </div>

        </article>
      `;
    })
    .join('');

  container
    .querySelectorAll('[data-raid]')
    .forEach(button => {
      button.onclick = () => {
        openRaid(button.dataset.raid);
      };
    });

  updateCountdowns();
}

/* =========================================================
   RAID
   ========================================================= */

function openRaid(territoryId) {
  if (!isStaff()) {
    showToast('STAFF ou ADMIN requis.');
    return;
  }

  const zone =
    territories.find(
      territory => territory.id === territoryId
    );

  if (!zone) return;

  if (!selectedFaction) {
    showToast('Choisis d’abord une organisation.');
    return;
  }

  if (isProtected(zone)) {
    showToast('Ce territoire est encore protégé.');
    return;
  }

  raidTarget = zone;

  const modal =
    document.getElementById('raidModal');

  const title =
    document.getElementById('modalTitle');

  const text =
    document.getElementById('modalText');

  title.textContent =
    `RAID — ${zone.name}`;

  text.innerHTML = `
    L'organisation
    <strong>${escapeHtml(selectedFaction)}</strong>
    va prendre le contrôle de
    <strong>${escapeHtml(zone.name)}</strong>.
    <br><br>
    Le territoire sera protégé jusqu'à
    <strong>21h00, heure de Paris, le 3e jour calendaire</strong>.
    <br><br>
    L'ancien détenteur restera enregistré dans
    <strong>ANCIENS DÉTENTEURS</strong>.
  `;

  modal.classList.remove('hidden');
}

async function confirmRaid() {
  if (!raidTarget || !selectedFaction) return;

  const button =
    document.getElementById('confirmRaid');

  button.disabled = true;

  const { data, error } =
    await supabase.rpc('raid_territory', {
      p_territory_id: raidTarget.id,
      p_holder_name: selectedFaction
    });

  button.disabled = false;

  if (error) {
    console.error(error);
    showToast(error.message);
    return;
  }

  closeRaidModal();

  showToast(
    `${selectedFaction} contrôle maintenant ${raidTarget.name}.`
  );

  raidTarget = null;

  await loadTerritories();
}

function closeRaidModal() {
  const modal =
    document.getElementById('raidModal');

  if (modal) {
    modal.classList.add('hidden');
  }

  raidTarget = null;
}

/* =========================================================
   ADMIN
   ========================================================= */

async function loadProfiles() {
  if (!isAdmin()) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role,created_at')
    .order('email');

  if (error) {
    console.error(error);
    showToast('Impossible de charger les utilisateurs.');
    return;
  }

  profiles = data || [];
}

async function changeRole(userId, role) {
  if (!isAdmin()) return;

  const { error } =
    await supabase.rpc('set_user_role', {
      p_user_id: userId,
      p_role: role
    });

  if (error) {
    console.error(error);
    showToast(error.message);
    return;
  }

  showToast('Rôle modifié.');

  await loadProfiles();

  openAdminPanel();
}

async function openAdminPanel() {
  if (!isAdmin()) {
    showToast('ADMIN requis.');
    return;
  }

  await loadProfiles();

  const existing =
    document.getElementById('adminModal');

  if (existing) existing.remove();

  const modal = document.createElement('div');

  modal.id = 'adminModal';
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-card" style="
      width:min(850px,100%);
      max-height:85vh;
      overflow:auto;
    ">

      <button
        class="close"
        id="closeAdmin"
      >
        ×
      </button>

      <p class="eyebrow">
        ADMIN / USERS
      </p>

      <div class="modal-signal">
        <span></span> USER MANAGEMENT
      </div>

      <h2>GESTION DES RÔLES</h2>

      <p>
        Les utilisateurs existants peuvent être
        classés VISITEUR, STAFF ou ADMIN.
      </p>

      <div style="
        margin-top:25px;
        border-top:1px solid #28313b;
      ">

        ${
          profiles.length
            ? profiles
                .map(
                  profile => `
                    <div style="
                      display:grid;
                      grid-template-columns:1fr auto;
                      gap:15px;
                      align-items:center;
                      padding:15px 0;
                      border-bottom:1px solid #1d252e;
                    ">

                      <div>
                        <strong style="
                          display:block;
                          font-size:12px;
                        ">
                          ${escapeHtml(
                            profile.email || 'Sans email'
                          )}
                        </strong>

                        <small style="
                          color:#5f6a77;
                          font-size:9px;
                        ">
                          ${escapeHtml(profile.role)}
                        </small>
                      </div>

                      <select
                        data-role-user="${escapeHtml(
                          profile.id
                        )}"
                        style="
                          background:#080c11;
                          color:white;
                          border:1px solid #303945;
                          padding:9px;
                        "
                      >
                        <option value="visiteur"
                          ${
                            profile.role === 'visiteur'
                              ? 'selected'
                              : ''
                          }>
                          VISITEUR
                        </option>

                        <option value="staff"
                          ${
                            profile.role === 'staff'
                              ? 'selected'
                              : ''
                          }>
                          STAFF
                        </option>

                        <option value="admin"
                          ${
                            profile.role === 'admin'
                              ? 'selected'
                              : ''
                          }>
                          ADMIN
                        </option>
                      </select>

                    </div>
                  `
                )
                .join('')
            : `
              <p>Aucun utilisateur.</p>
            `
        }

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('closeAdmin').onclick =
    () => modal.remove();

  modal
    .querySelectorAll('[data-role-user]')
    .forEach(select => {
      select.onchange = () => {
        changeRole(
          select.dataset.roleUser,
          select.value
        );
      };
    });
}

/* =========================================================
   COMPTEUR
   ========================================================= */

function updateCountdowns() {
  document
    .querySelectorAll('[data-expiry]')
    .forEach(element => {
      const expiry = element.dataset.expiry;

      if (!expiry) return;

      const remaining =
        new Date(expiry).getTime() - Date.now();

      element.textContent =
        remaining > 0
          ? formatCountdown(remaining)
          : 'RAID POSSIBLE';
    });
}

/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

function setupEvents() {
  const clear =
    document.getElementById('clearSelection');

  if (clear) {
    clear.onclick = () => {
      selectedFaction = null;

      const selected =
        document.getElementById('selectedFaction');

      if (selected) {
        selected.textContent = 'AUCUN';
      }

      renderTicker();
      renderTerritories();

      showToast('Sélection effacée.');
    };
  }

  const confirm =
    document.getElementById('confirmRaid');

  if (confirm) {
    confirm.onclick = confirmRaid;
  }

  const cancel =
    document.getElementById('cancelRaid');

  if (cancel) {
    cancel.onclick = closeRaidModal;
  }

  const close =
    document.getElementById('closeModal');

  if (close) {
    close.onclick = closeRaidModal;
  }

  const raidModal =
    document.getElementById('raidModal');

  if (raidModal) {
    raidModal.addEventListener(
      'click',
      event => {
        if (event.target === raidModal) {
          closeRaidModal();
        }
      }
    );
  }
}

/* =========================================================
   INITIALISATION
   ========================================================= */

async function init() {
  try {
    await loadSupabaseLibrary();

    supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    injectAuthInterface();

    await loadCurrentUser();

    renderAuthArea();

    renderTicker();

    setupEvents();

    await loadTerritories();

    supabase.auth.onAuthStateChange(
      async (_event, session) => {
        currentUser = session?.user || null;

        await loadCurrentUser();

        renderAuthArea();

        await loadTerritories();
      }
    );

    setInterval(updateCountdowns, 1000);

    /*
      Actualisation régulière :
      tout le monde voit les changements partagés
      sans avoir besoin de recharger la page.
    */
    setInterval(loadTerritories, 10000);

  } catch (error) {
    console.error(error);
    showToast('Erreur de démarrage de I-ISLAND.');
  }
}

init();
