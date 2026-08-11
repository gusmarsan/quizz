const PROFILE_DB_NAME = "burrquizzz-profile";
const PROFILE_DB_VERSION = 1;
const PROFILE_STORE = "profile";
const PROFILE_PHOTO_KEY = "avatar-photo";
const PROFILE_FALLBACK_KEY = "burrquizzzAvatarPhoto";
const PROFILE_MAX_SIZE = 512;

let currentAvatarUrl = "";
let hasStoredPhoto = false;

const avatar = document.querySelector("#homeUserInitial");
const onlineNameInput = document.querySelector("#onlineName");
const toastElement = document.querySelector("#toast");

function showProfileToast(message) {
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  clearTimeout(showProfileToast.timeout);
  showProfileToast.timeout = window.setTimeout(() => toastElement.classList.remove("visible"), 2400);
}

function openProfileDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("indexeddb-unavailable"));
      return;
    }

    const request = indexedDB.open(PROFILE_DB_NAME, PROFILE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexeddb-open-failed"));
  });
}

async function readIndexedPhoto() {
  const db = await openProfileDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readonly");
      const request = tx.objectStore(PROFILE_STORE).get(PROFILE_PHOTO_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("indexeddb-read-failed"));
    });
  } finally {
    db.close();
  }
}

async function writeIndexedPhoto(blob) {
  const db = await openProfileDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readwrite");
      tx.objectStore(PROFILE_STORE).put(blob, PROFILE_PHOTO_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("indexeddb-write-failed"));
      tx.onabort = () => reject(tx.error || new Error("indexeddb-write-aborted"));
    });
  } finally {
    db.close();
  }
}

async function deleteIndexedPhoto() {
  const db = await openProfileDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readwrite");
      tx.objectStore(PROFILE_STORE).delete(PROFILE_PHOTO_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("indexeddb-delete-failed"));
      tx.onabort = () => reject(tx.error || new Error("indexeddb-delete-aborted"));
    });
  } finally {
    db.close();
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("file-read-failed"));
    reader.readAsDataURL(blob);
  });
}

async function savePhoto(blob) {
  try {
    await writeIndexedPhoto(blob);
    localStorage.removeItem(PROFILE_FALLBACK_KEY);
    return;
  } catch (error) {
    console.warn("Perfil: IndexedDB indisponível, usando armazenamento local alternativo.", error);
  }

  const dataUrl = await blobToDataUrl(blob);
  localStorage.setItem(PROFILE_FALLBACK_KEY, dataUrl);
}

async function readPhoto() {
  try {
    const stored = await readIndexedPhoto();
    if (stored instanceof Blob) return stored;
  } catch (error) {
    console.warn("Perfil: não foi possível ler a foto do IndexedDB.", error);
  }

  return localStorage.getItem(PROFILE_FALLBACK_KEY) || null;
}

async function removePhoto() {
  try {
    await deleteIndexedPhoto();
  } catch (error) {
    console.warn("Perfil: não foi possível apagar a foto do IndexedDB.", error);
  }
  localStorage.removeItem(PROFILE_FALLBACK_KEY);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid-image"));
    };
    image.src = url;
  });
}

async function normalizePhoto(file) {
  const { image, url } = await loadImage(file);
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error("invalid-image-size");

    const sourceSide = Math.min(sourceWidth, sourceHeight);
    const sx = Math.max(0, (sourceWidth - sourceSide) / 2);
    const sy = Math.max(0, (sourceHeight - sourceSide) / 2);
    const outputSize = Math.min(PROFILE_MAX_SIZE, sourceSide);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("canvas-unavailable");

    context.drawImage(image, sx, sy, sourceSide, sourceSide, 0, 0, outputSize, outputSize);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("image-conversion-failed"));
      }, "image/jpeg", .86);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setAvatarPhoto(photo) {
  if (!avatar) return;

  if (currentAvatarUrl) {
    URL.revokeObjectURL(currentAvatarUrl);
    currentAvatarUrl = "";
  }

  if (!photo) {
    hasStoredPhoto = false;
    avatar.style.removeProperty("background-image");
    avatar.classList.remove("has-photo");
    updateDialogState();
    return;
  }

  const source = photo instanceof Blob ? URL.createObjectURL(photo) : String(photo);
  if (photo instanceof Blob) currentAvatarUrl = source;
  hasStoredPhoto = true;
  avatar.style.backgroundImage = `url("${source.replace(/"/g, "%22")}")`;
  avatar.classList.add("has-photo");
  updateDialogState();
}

function createPhotoDialog() {
  let dialog = document.querySelector("#profilePhotoDialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "profilePhotoDialog";
  dialog.className = "profile-photo-dialog";
  dialog.innerHTML = `
    <div class="profile-photo-dialog__card">
      <div class="profile-photo-dialog__head">
        <p class="profile-photo-dialog__eyebrow">Perfil</p>
        <h2>Sua foto no Burrquizzz</h2>
        <p class="profile-photo-dialog__copy">A imagem fica salva apenas neste aparelho e aparece no lugar da sua inicial.</p>
      </div>
      <div class="profile-photo-dialog__actions">
        <button class="profile-photo-dialog__choose" type="button">Escolher foto</button>
        <button class="profile-photo-dialog__remove" type="button" hidden>Remover foto</button>
        <button class="profile-photo-dialog__cancel" type="button">Cancelar</button>
      </div>
      <input class="profile-photo-dialog__input" type="file" accept="image/*" hidden />
    </div>
  `;
  document.body.appendChild(dialog);

  const chooseButton = dialog.querySelector(".profile-photo-dialog__choose");
  const removeButton = dialog.querySelector(".profile-photo-dialog__remove");
  const cancelButton = dialog.querySelector(".profile-photo-dialog__cancel");
  const fileInput = dialog.querySelector(".profile-photo-dialog__input");

  chooseButton?.addEventListener("click", () => fileInput?.click());
  cancelButton?.addEventListener("click", () => dialog.close());
  removeButton?.addEventListener("click", async () => {
    await removePhoto();
    setAvatarPhoto(null);
    dialog.close();
    showProfileToast("Foto removida");
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showProfileToast("Escolha uma imagem");
      return;
    }

    chooseButton.disabled = true;
    chooseButton.textContent = "Salvando…";
    try {
      const normalized = await normalizePhoto(file);
      await savePhoto(normalized);
      setAvatarPhoto(normalized);
      dialog.close();
      showProfileToast("Foto salva neste aparelho");
    } catch (error) {
      console.error(error);
      showProfileToast("Não foi possível salvar a foto");
    } finally {
      chooseButton.disabled = false;
      chooseButton.textContent = hasStoredPhoto ? "Trocar foto" : "Escolher foto";
    }
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  return dialog;
}

function updateDialogState() {
  const dialog = document.querySelector("#profilePhotoDialog");
  if (!dialog) return;
  const chooseButton = dialog.querySelector(".profile-photo-dialog__choose");
  const removeButton = dialog.querySelector(".profile-photo-dialog__remove");
  if (chooseButton) chooseButton.textContent = hasStoredPhoto ? "Trocar foto" : "Escolher foto";
  if (removeButton) removeButton.hidden = !hasStoredPhoto;
}

function openPhotoDialog() {
  const dialog = createPhotoDialog();
  updateDialogState();
  if (!dialog.open) dialog.showModal();
}

function setupAvatarAction() {
  if (!avatar) return;
  avatar.classList.add("profile-avatar-action");
  avatar.removeAttribute("aria-hidden");
  avatar.setAttribute("role", "button");
  avatar.setAttribute("tabindex", "0");
  avatar.setAttribute("aria-label", "Adicionar ou trocar foto do perfil");
  avatar.setAttribute("title", "Adicionar ou trocar foto");
  avatar.addEventListener("click", openPhotoDialog);
  avatar.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPhotoDialog();
    }
  });
}

function setupDuelPhotoLink() {
  if (!onlineNameInput) return;
  const nameField = onlineNameInput.closest("label.field");
  if (!nameField || document.querySelector("#onlineAddPhotoLink")) return;

  const link = document.createElement("button");
  link.id = "onlineAddPhotoLink";
  link.className = "profile-photo-link";
  link.type = "button";
  link.textContent = "Adicionar foto >";
  link.addEventListener("click", openPhotoDialog);
  nameField.insertAdjacentElement("afterend", link);
}

async function initProfilePhoto() {
  setupAvatarAction();
  setupDuelPhotoLink();
  createPhotoDialog();
  const savedPhoto = await readPhoto();
  setAvatarPhoto(savedPhoto);
}

initProfilePhoto().catch((error) => console.warn("Perfil: não foi possível iniciar a foto local.", error));

window.addEventListener("beforeunload", () => {
  if (currentAvatarUrl) URL.revokeObjectURL(currentAvatarUrl);
});
