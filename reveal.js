window.addEventListener("DOMContentLoaded", async () => {
  /* ------------------------------------------------------------------ *
   *  Config — edit names / files here. Add or remove rows freely.
   * ------------------------------------------------------------------ */
  const DEFAULT_INGREDIENTS = [
    ["Boerhavia Diffusa", "boerhavia-diffusa"],
    ["Cichorium Intybus", "cichorium-intybus"],
    ["Eclipta Alba", "eclipta-alba"],
    ["Himalayan Black Salt", "himalayan-black-salt"],
    ["Operculina Turpethum", "operculina-turpethum"],
    ["Oroxylum Indicum", "oroxylum-indicum"],
    ["Phyllanthus Niruri", "phyllanthus-niruri"],
    ["Picrorhiza Kurroa", "picrorhiza-kurroa"],
    ["Rock Salt", "rock-salt"],
    ["Swertia Chirata", "swertia-chirata"],
    ["Tinospora Cordifolia", "tinospora-cordifolia"],
  ].map(([name, file]) => ({ id: file, name, src: `assets/${file}.png` }));
  const PRODUCT_DEFAULT = "assets/bottle.png";
  const LEGACY_LIBRARY_KEY = "ingredient-reveal-library";
  const LEGACY_PRODUCTS_KEY = "ingredient-reveal-products";
  const STORAGE_BUCKET = "product-images";
  const INK = "#315b24";
  const PRODUCT_STYLES = [
    { id: "soft", name: "Soft herbal reveal", description: "A gentle fade, rise and calm finish." },
    { id: "turntable", name: "Turntable spin", description: "A measured turn with a soft light sweep." },
    { id: "halo", name: "Botanical halo", description: "A floating reveal with a subtle halo and shimmer." },
  ];

  const stageEl = document.getElementById("stage");
  const loadingEl = document.getElementById("loading");
  const replayBtn = document.getElementById("replay-btn");
  const downloadBtn = document.getElementById("download-btn");
  const ingredientListEl = document.getElementById("ingredient-list");
  const ingredientCountEl = document.getElementById("ingredient-count");
  const productPreviewEl = document.getElementById("product-preview");
  const managerStatusEl = document.getElementById("manager-status");
  const productSelectEl = document.getElementById("product-select");
  const productNameEl = document.getElementById("product-name");
  const productCountEl = document.getElementById("product-count");
  const stylePositionEl = document.getElementById("product-style-position");
  const styleNameEl = document.getElementById("product-style-name");
  const styleDescriptionEl = document.getElementById("product-style-description");
  const styleDotsEl = document.getElementById("product-style-dots");

  const createProduct = (name, id = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`) => ({
    id,
    name,
    ingredients: DEFAULT_INGREDIENTS.map((item) => ({ ...item })),
    productSrc: PRODUCT_DEFAULT,
    productAnimation: "soft",
  });
  const isValidProduct = (item) =>
    item &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    Array.isArray(item.ingredients) &&
    item.ingredients.every((ingredient) =>
      ingredient &&
      typeof ingredient.id === "string" &&
      typeof ingredient.name === "string" &&
      typeof ingredient.src === "string"
    ) &&
    typeof item.productSrc === "string" &&
    PRODUCT_STYLES.some((style) => style.id === item.productAnimation);

  let products = [];
  let activeProductId = "";
  let ingredients = [];
  let productSrc = PRODUCT_DEFAULT;
  let productAnimation = "soft";
  let supabaseClient;
  const activeProduct = () => products.find((item) => item.id === activeProductId);

  function readLegacyProducts() {
    try {
      const savedLibrary = localStorage.getItem(LEGACY_PRODUCTS_KEY);
      if (savedLibrary) {
        const parsed = JSON.parse(savedLibrary);
        if (
          parsed &&
          Array.isArray(parsed.products) &&
          parsed.products.length > 0 &&
          parsed.products.every(isValidProduct) &&
          parsed.products.some((item) => item.id === parsed.activeProductId)
        ) {
          return { products: parsed.products, activeProductId: parsed.activeProductId };
        }
      }

      const savedConfig = localStorage.getItem(LEGACY_LIBRARY_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (
          parsed &&
          Array.isArray(parsed.ingredients) &&
          parsed.ingredients.every((item) =>
            item && typeof item.id === "string" && typeof item.name === "string" && typeof item.src === "string"
          ) &&
          typeof parsed.productSrc === "string"
        ) {
          const product = {
            id: "migrated-product",
            name: "My product",
            ingredients: parsed.ingredients,
            productSrc: parsed.productSrc,
            productAnimation: PRODUCT_STYLES.some((style) => style.id === parsed.productAnimation)
              ? parsed.productAnimation
              : "soft",
          };
          return { products: [product], activeProductId: product.id };
        }
      }
    } catch (err) {
      setStatus("Could not import previous browser data: " + err.message, true);
    }
    return null;
  }

  async function loadProductDatabase() {
    if (
      !window.supabase ||
      typeof window.SUPABASE_URL !== "string" ||
      !window.SUPABASE_URL.startsWith("https://") ||
      typeof window.SUPABASE_ANON_KEY !== "string" ||
      !window.SUPABASE_ANON_KEY ||
      window.SUPABASE_ANON_KEY.includes("YOUR_")
    ) {
      throw new Error("Add your Supabase project URL and public anon key to supabase-config.js.");
    }

    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data, error } = await supabaseClient
      .from("products")
      .select("id, name, ingredients, product_src, product_animation, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("Supabase returned invalid product data.");

    if (data.length > 0) {
      products = data.map((row) => ({
        id: row.id,
        name: row.name,
        ingredients: row.ingredients,
        productSrc: row.product_src,
        productAnimation: row.product_animation,
      }));
      if (
        !products.every(isValidProduct) ||
        new Set(products.map((item) => item.id)).size !== products.length
      ) {
        throw new Error("The saved product database is invalid.");
      }
      try {
        activeProductId = localStorage.getItem("ingredient-reveal-active-product");
      } catch (err) {
        setStatus("Could not read the selected product preference: " + err.message, true);
      }
      if (!products.some((item) => item.id === activeProductId)) activeProductId = products[0].id;
    } else {
      const imported = readLegacyProducts();
      const initialProducts = imported ? imported.products : [createProduct("My product", "default-product")];
      for (let i = 0; i < initialProducts.length; i++) {
        const savedProduct = await saveProduct(initialProducts[i], i, true);
        if (!savedProduct) throw new Error("Could not save every initial product to Supabase.");
        products.push(savedProduct);
      }
      activeProductId = imported && products.some((item) => item.id === imported.activeProductId)
        ? imported.activeProductId
        : products[0].id;
    }
    ({ ingredients, productSrc, productAnimation } = activeProduct());
  }

  try {
    await loadProductDatabase();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus("Could not load shared products: " + message, true);
    loadingEl.textContent = "Product library could not be loaded. See the status message for details.";
    return;
  }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ *
   *  Renderer / camera  (1 world unit = 1/10 of the stage height)
   * ------------------------------------------------------------------ */
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0xffffff, 1);
  stageEl.insertBefore(renderer.domElement, stageEl.firstChild);

  const scene = new THREE.Scene();
  const FOV = 30;
  const camZ = 5 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, camZ);

  function resize() {
    const s = stageEl.clientWidth;
    renderer.setSize(s, s, false);
  }
  resize();
  window.addEventListener("resize", resize);

  /* ------------------------------------------------------------------ *
   *  Helpers
   * ------------------------------------------------------------------ */
  function radialTexture(stops) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }

  function flatMaterial(map) {
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }

  function makePlane(map, w, h, order) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flatMaterial(map));
    m.renderOrder = order;
    return m;
  }

  function makeLabel(text) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d");
    g.font = '600 44px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const words = text.split(/\s+/);
    const lines = [];
    let cur = "";
    words.forEach((w) => {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && g.measureText(test).width > 400) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    });
    if (cur) lines.push(cur);
    const lh = 52;
    g.fillStyle = INK;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const top = 64 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, k) => g.fillText(l, 256, top + k * lh));
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    );
    s.scale.set(1.9, 0.48, 1);
    s.renderOrder = 8;
    return s;
  }

  // blurred, tinted silhouette of an image -> soft drop shadow (works in every browser)
  function shadowTexture(img) {
    const pad = 48;
    const c = document.createElement("canvas");
    c.width = img.width + pad * 2;
    c.height = img.height + pad * 2;
    const g = c.getContext("2d");
    g.shadowColor = "rgba(39,92,83,0.45)";
    g.shadowBlur = 18;
    g.shadowOffsetX = 10000;
    g.drawImage(img, pad - 10000, pad);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return { map: t, wPad: c.width / img.width, hPad: c.height / img.height };
  }

  const loader = new THREE.TextureLoader();
  // prefer the embedded copy (works on file://), fall back to the file on disk
  const resolveUrl = (url) => (window.ASSET_DATA && window.ASSET_DATA[url.split("/").pop()]) || url;
  const loadTex = (url) =>
    new Promise((resolve, reject) => {
      loader.load(
        resolveUrl(url),
        (t) => {
          t.minFilter = THREE.LinearFilter;
          t.generateMipmaps = false;
          resolve(t);
        },
        undefined,
        reject
      );
    });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function setStatus(message, isError = false) {
    managerStatusEl.textContent = message;
    managerStatusEl.classList.toggle("error", isError);
  }

  function renderManager() {
    productSelectEl.innerHTML = products.map((item) =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    ).join("");
    productSelectEl.value = activeProductId;
    productNameEl.value = activeProduct().name;
    productCountEl.textContent = String(products.length).padStart(2, "0");
    document.getElementById("product-delete").disabled = products.length <= 1;
    productPreviewEl.src = resolveUrl(productSrc);
    const activeStyleIndex = PRODUCT_STYLES.findIndex((style) => style.id === productAnimation);
    const activeStyle = PRODUCT_STYLES[activeStyleIndex];
    stylePositionEl.textContent = `${String(activeStyleIndex + 1).padStart(2, "0")} / ${String(PRODUCT_STYLES.length).padStart(2, "0")}`;
    styleNameEl.textContent = activeStyle.name;
    styleDescriptionEl.textContent = activeStyle.description;
    styleDotsEl.innerHTML = PRODUCT_STYLES.map((style, index) => `
      <button class="style-dot" type="button" data-style="${style.id}" aria-label="Show ${style.name}" aria-current="${index === activeStyleIndex}"></button>
    `).join("");
    ingredientCountEl.textContent = String(ingredients.length).padStart(2, "0");
    ingredientListEl.innerHTML = ingredients.length
      ? ingredients.map((item, index) => `
        <div class="ingredient-row" data-index="${index}">
          <img class="ingredient-preview" src="${escapeHtml(resolveUrl(item.src))}" alt="" />
          <div class="ingredient-fields">
            <input class="text-input ingredient-name" type="text" value="${escapeHtml(item.name)}" aria-label="Ingredient ${index + 1} name" maxlength="80" />
            <div class="ingredient-actions">
              <input class="file-input ingredient-image-input" id="ingredient-image-${index}" type="file" accept="image/*" />
              <label class="mini-action" for="ingredient-image-${index}" title="Change image" aria-label="Change image for ${escapeHtml(item.name)}">IMG</label>
            </div>
          </div>
          <button class="mini-action delete-action" type="button" data-action="delete" aria-label="Delete ${escapeHtml(item.name)}" title="Delete ingredient">×</button>
        </div>`).join("")
      : '<p class="empty-list">No ingredients yet. Add one below.</p>';
  }

  function disposeTexture(texture) {
    if (texture && typeof texture.dispose === "function") texture.dispose();
  }

  async function fileAsDataUrl(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Choose a valid image file.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Images must be smaller than 10 MB.");
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL("image/webp", 0.9);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the selected image."));
      reader.readAsDataURL(file);
    });
  }

  async function validateImage(src) {
    const texture = await loadTex(src);
    const valid = texture.image && texture.image.width > 0 && texture.image.height > 0;
    disposeTexture(texture);
    if (!valid) throw new Error("The selected file is not a usable image.");
  }

  const safeStoragePart = (value) => String(value).replace(/[^a-z0-9._-]/gi, "_") || "image";

  async function uploadImageIfNeeded(src, path) {
    if (!src.startsWith("data:image/")) return src;
    const response = await fetch(src);
    if (!response.ok) throw new Error("Could not read the selected image for upload.");
    const image = await response.blob();
    const uploadPath = `${path}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(uploadPath, image, {
      upsert: false,
      contentType: image.type || "image/webp",
    });
    if (error) throw new Error(error.message);
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(uploadPath);
    return data.publicUrl;
  }

  async function saveProduct(product, sortOrder, throwOnError = false) {
    try {
      const productFolder = safeStoragePart(product.id);
      const savedProduct = {
        ...product,
        productSrc: await uploadImageIfNeeded(product.productSrc, `${productFolder}/product-image`),
        ingredients: await Promise.all(product.ingredients.map(async (ingredient) => ({
          ...ingredient,
          src: await uploadImageIfNeeded(
            ingredient.src,
            `${productFolder}/ingredient-${safeStoragePart(ingredient.id)}`
          ),
        }))),
      };
      const { error } = await supabaseClient.from("products").upsert({
        id: savedProduct.id,
        name: savedProduct.name,
        ingredients: savedProduct.ingredients,
        product_src: savedProduct.productSrc,
        product_animation: savedProduct.productAnimation,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        throw new Error(error.message);
      }
      return savedProduct;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("Could not save product to the shared database: " + message, true);
      if (throwOnError) throw err;
      return null;
    }
  }

  function getProductImageUrls(product) {
    return [product.productSrc, ...product.ingredients.map((item) => item.src)];
  }

  function storagePathFromPublicUrl(src) {
    const publicUrl = `${window.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/`;
    if (!src.startsWith(publicUrl)) return null;
    try {
      return decodeURIComponent(src.slice(publicUrl.length));
    } catch (err) {
      return null;
    }
  }

  async function removeOrphanedImages(previousProduct, nextProduct) {
    if (!previousProduct) return null;
    const nextUrls = new Set(getProductImageUrls(nextProduct));
    const paths = getProductImageUrls(previousProduct)
      .filter((src) => !nextUrls.has(src))
      .map(storagePathFromPublicUrl)
      .filter(Boolean);
    if (!paths.length) return null;
    try {
      const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);
      return error ? error.message : null;
    } catch (err) {
      return err.message;
    }
  }

  async function deleteProductFromCloud(product) {
    const { error } = await supabaseClient.from("products").delete().eq("id", product.id);
    if (error) {
      setStatus("Could not delete product from the shared database: " + error.message, true);
      return null;
    }
    const paths = getProductImageUrls(product).map(storagePathFromPublicUrl).filter(Boolean);
    let cleanupError = "";
    if (paths.length) {
      try {
        const { error: imageError } = await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);
        if (imageError) cleanupError = imageError.message;
      } catch (err) {
        cleanupError = err.message;
      }
    }
    return cleanupError;
  }

  async function saveConfig(nextIngredients, nextProductSrc, statusMessage, nextProductAnimation = productAnimation) {
    const previousProduct = activeProduct();
    const index = products.findIndex((item) => item.id === activeProductId);
    const updatedProduct = await saveProduct({
      ...previousProduct,
      ingredients: nextIngredients,
      productSrc: nextProductSrc,
      productAnimation: nextProductAnimation,
    }, index);
    if (!updatedProduct) return;
    products = products.map((item) => item.id === activeProductId ? updatedProduct : item);
    ingredients = nextIngredients;
    productSrc = nextProductSrc;
    productAnimation = nextProductAnimation;
    renderManager();
    const errors = [];
    const cleanupError = await removeOrphanedImages(previousProduct, updatedProduct);
    if (cleanupError) errors.push("Old image cleanup failed: " + cleanupError);
    try {
      await rebuildScene();
    } catch (err) {
      errors.push("Reveal update failed: " + err.message);
    }
    setStatus(errors.length ? `${statusMessage} ${errors.join(" ")}` : statusMessage, errors.length > 0);
  }

  async function saveAnimationStyle(style) {
    const index = products.findIndex((item) => item.id === activeProductId);
    const updatedProduct = await saveProduct({ ...activeProduct(), productAnimation: style }, index);
    if (!updatedProduct) return;
    products = products.map((item) => item.id === activeProductId ? updatedProduct : item);
    productAnimation = style;
    renderManager();
    setStatus("Product reveal style updated.");
    play();
  }

  function cycleAnimationStyle(direction) {
    const currentIndex = PRODUCT_STYLES.findIndex((style) => style.id === productAnimation);
    const nextIndex = (currentIndex + direction + PRODUCT_STYLES.length) % PRODUCT_STYLES.length;
    saveAnimationStyle(PRODUCT_STYLES[nextIndex].id);
  }

  async function handleImageUpload(file, update) {
    try {
      const src = await fileAsDataUrl(file);
      await validateImage(src);
      await update(src);
    } catch (err) {
      setStatus(err.message || "Could not load the selected image.", true);
    }
  }

  async function activateProduct(id) {
    const selected = products.find((item) => item.id === id);
    if (!selected) return;
    try {
      localStorage.setItem("ingredient-reveal-active-product", id);
    } catch (err) {
      setStatus("Could not save the selected product preference: " + err.message, true);
    }
    activeProductId = id;
    ({ ingredients, productSrc, productAnimation } = selected);
    renderManager();
    setStatus(`${selected.name} selected.`);
    try {
      await rebuildScene();
    } catch (err) {
      setStatus("Product was selected, but the reveal could not be updated: " + err.message, true);
    }
  }

  productSelectEl.addEventListener("change", (event) => activateProduct(event.target.value));
  productNameEl.addEventListener("change", async () => {
    const name = productNameEl.value.trim();
    if (!name) {
      productNameEl.value = activeProduct().name;
      setStatus("Product names cannot be empty.", true);
      return;
    }
    const index = products.findIndex((item) => item.id === activeProductId);
    const updatedProduct = await saveProduct({ ...activeProduct(), name }, index);
    if (!updatedProduct) {
      renderManager();
      return;
    }
    products = products.map((item) => item.id === activeProductId ? updatedProduct : item);
    renderManager();
    setStatus("Product name updated.");
    try {
      await rebuildScene();
    } catch (err) {
      setStatus("Product name was saved, but the reveal could not be updated: " + err.message, true);
    }
  });

  document.getElementById("product-add").addEventListener("click", async () => {
    const product = createProduct(`Product ${products.length + 1}`);
    const savedProduct = await saveProduct(product, products.length);
    if (!savedProduct) return;
    products = [...products, savedProduct];
    activeProductId = savedProduct.id;
    ({ ingredients, productSrc, productAnimation } = savedProduct);
    renderManager();
    setStatus("Product created.");
    try {
      await rebuildScene();
    } catch (err) {
      setStatus("Product was created, but the reveal could not be updated: " + err.message, true);
    }
  });

  document.getElementById("product-delete").addEventListener("click", async () => {
    if (products.length <= 1 || !window.confirm(`Delete "${activeProduct().name}"?`)) return;
    const deletedProduct = activeProduct();
    const cleanupError = await deleteProductFromCloud(deletedProduct);
    if (cleanupError === null) return;
    const updatedProducts = products.filter((item) => item.id !== activeProductId);
    const nextProduct = updatedProducts[0];
    products = updatedProducts;
    activeProductId = nextProduct.id;
    ({ ingredients, productSrc, productAnimation } = nextProduct);
    renderManager();
    setStatus(
      cleanupError
        ? "Product deleted, but its stored images could not be removed: " + cleanupError
        : "Product deleted.",
      Boolean(cleanupError)
    );
    try {
      await rebuildScene();
    } catch (err) {
      setStatus("Product was deleted, but the reveal could not be updated: " + err.message, true);
    }
  });

  document.getElementById("product-upload").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    handleImageUpload(file, (src) => saveConfig(ingredients, src, "Product image updated."));
    event.target.value = "";
  });

  document.getElementById("product-reset").addEventListener("click", () => {
    if (productSrc !== PRODUCT_DEFAULT) saveConfig(ingredients, PRODUCT_DEFAULT, "Product image restored.");
  });

  document.getElementById("product-style-prev").addEventListener("click", () => cycleAnimationStyle(-1));
  document.getElementById("product-style-next").addEventListener("click", () => cycleAnimationStyle(1));
  styleDotsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-style]");
    if (button) saveAnimationStyle(button.dataset.style);
  });

  ingredientListEl.addEventListener("change", (event) => {
    const row = event.target.closest(".ingredient-row");
    if (!row) return;
    const index = Number(row.dataset.index);
    if (event.target.matches(".ingredient-name")) {
      const name = event.target.value.trim();
      if (!name) {
        event.target.value = ingredients[index].name;
        setStatus("Ingredient names cannot be empty.", true);
        return;
      }
      const updated = ingredients.map((item, i) => i === index ? { ...item, name } : item);
      saveConfig(updated, productSrc, "Ingredient name updated.");
    } else if (event.target.matches(".ingredient-image-input")) {
      const file = event.target.files[0];
      if (!file) return;
      handleImageUpload(file, (src) => {
        const updated = ingredients.map((item, i) => i === index ? { ...item, src } : item);
        return saveConfig(updated, productSrc, "Ingredient image updated.");
      });
      event.target.value = "";
    }
  });

  ingredientListEl.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;
    const row = button.closest(".ingredient-row");
    const index = Number(row.dataset.index);
    const updated = ingredients.filter((_, i) => i !== index);
    saveConfig(updated, productSrc, "Ingredient deleted.");
  });

  document.getElementById("add-ingredient-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const nameInput = document.getElementById("new-ingredient-name");
    const imageInput = document.getElementById("new-ingredient-image");
    const name = nameInput.value.trim();
    const file = imageInput.files[0];
    if (!name || !file) {
      setStatus("Enter a name and choose an ingredient image.", true);
      return;
    }
    handleImageUpload(file, (src) => {
      const id = `ingredient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return saveConfig([...ingredients, { id, name, src }], productSrc, "Ingredient added.");
    }).then(() => {
      if (!managerStatusEl.classList.contains("error")) {
        nameInput.value = "";
        imageInput.value = "";
      }
    });
  });

  renderManager();

  /* ------------------------------------------------------------------ *
   *  Animation state — the GSAP timeline only tweens these numbers;
   *  update() turns them into the 3D scene every frame.
   * ------------------------------------------------------------------ */
  const S = {
    intro: 1, ringIn: 0, rot: 0, labels: 1, gather: 0, release: 0,
    aura: 0, burst: 0,
    bottleOp: 0, bottle: 0, turn: 0, shadow: 0, shine: -0.4, hold: 0,
  };
  const resetState = () =>
    Object.assign(S, {
      intro: 1, ringIn: 0, rot: 0, labels: 1, gather: 0, release: 0,
      aura: 0, burst: 0,
      bottleOp: 0, bottle: 0, turn: 0, shadow: 0, shine: -0.4, hold: 0,
    });

  const easePop = gsap.parseEase("power3.out");
  const easeGather = gsap.parseEase("power2.inOut");
  const easeRelease = gsap.parseEase("power3.out");

  /* ------------------------------------------------------------------ *
   *  Scene objects (built after textures load)
   * ------------------------------------------------------------------ */
  const R = 3.8; // ring radius
  const ITEM_MAX = 1.15; // largest side of an ingredient image
  const BOTTLE_H = 5.2;
  const BOTTLE_Y = 0;

  const items = [];
  let aura, burstGlow, particles, particleGeometry, particleDirections, particleSpeeds, particlePhases, particleBaseColors;
  let motes, moteGeo, moteBase;
  let bottleGroup, bottleMesh, bottleMat, productNameLabel, shadowPlane, contactShadow;
  let tl = null;

  function buildScene(ingTextures, bottleTex) {
    // soft aura behind the centre
    aura = makePlane(
      radialTexture([[0, "rgba(222,232,207,0.72)"], [0.5, "rgba(238,243,229,0.34)"], [1, "rgba(255,255,255,0)"]]),
      6.4, 6.4, 1
    );
    aura.position.z = -0.4;
    scene.add(aura);

    // ingredients + name labels
    const n = ingredients.length;
    ingredients.forEach((ingredient, i) => {
      const tex = ingTextures[i];
      const iw = tex.image.width;
      const ih = tex.image.height;
      const k = ITEM_MAX / Math.max(iw, ih);
      const w = iw * k;
      const h = ih * k;
      const sh = shadowTexture(tex.image);
      const shadow = makePlane(sh.map, w * sh.wPad, h * sh.hPad, 1);
      scene.add(shadow);
      const mesh = makePlane(tex, w, h, 2);
      scene.add(mesh);
      const label = makeLabel(ingredient.name);
      scene.add(label);
      items.push({ mesh, shadow, label, h, a0: -Math.PI / 2 + (i / n) * TAU });
    });

    // Soft sage motes replace the hard orbit outline.
    const MN = 14;
    moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MN * 3), 3));
    moteBase = [];
    for (let i = 0; i < MN; i++) {
      moteBase.push({
        x: (Math.random() - 0.5) * 9, y: (Math.random() - 0.5) * 9, z: Math.random() * 2.4 - 0.6,
        sp: 0.3 + Math.random() * 0.5, ph: Math.random() * TAU,
      });
    }
    motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        size: 0.085, color: 0x91a66f, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
        map: radialTexture([[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,0.7)"], [1, "rgba(255,255,255,0)"]]),
      })
    );
    motes.renderOrder = 2;
    motes.frustumCulled = false;
    scene.add(motes);

    const particleCount = 960;
    particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
    particleDirections = [];
    particleSpeeds = [];
    particlePhases = [];
    particleBaseColors = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const centerColor = new THREE.Color(0x9ccc70);
    const edgeColor = new THREE.Color(0x285c1e);
    const particleColor = new THREE.Color();
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * TAU;
      const elevation = (Math.random() - 0.5) * 1.3;
      particleDirections.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle), elevation).normalize());
      particleSpeeds.push(0.7 + Math.random() * 2.6);
      particlePhases.push(Math.random() * TAU);
      particleColor.copy(centerColor).lerp(edgeColor, (particleSpeeds[i] - 0.7) / 2.6);
      particleColor.toArray(colors, i * 3);
    }
    particleBaseColors.set(colors);
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        size: 0.1,
        color: 0xffffff,
        map: radialTexture([[0, "rgba(255,255,255,0.95)"], [0.45, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]),
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    particles.renderOrder = 6;
    particles.visible = false;
    particles.frustumCulled = false;
    scene.add(particles);

    burstGlow = makePlane(
      radialTexture([
        [0, "rgba(70,125,36,0.62)"],
        [0.28, "rgba(91,145,49,0.42)"],
        [0.68, "rgba(120,163,82,0.16)"],
        [1, "rgba(255,255,255,0)"],
      ]),
      5.2, 5.2, 5.5
    );
    burstGlow.position.set(0, 0, 0.88);
    scene.add(burstGlow);

    // bottle: shader material gives us a diagonal light sweep after it lands
    const bw = BOTTLE_H * (bottleTex.image.width / bottleTex.image.height);
    bottleMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: bottleTex }, uOpacity: { value: 0 }, uShine: { value: -0.4 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D map;
        uniform float uOpacity;
        uniform float uShine;
        varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          float d = vUv.x * 0.8 + vUv.y * 0.6;
          float x = (d - uShine) / 0.12;
          float band = exp(-x * x);
          vec3 col = t.rgb + vec3(0.95, 0.88, 0.68) * band * 0.4 * t.a;
          gl_FragColor = vec4(col, t.a * uOpacity);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    bottleMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, BOTTLE_H), bottleMat);
    bottleMesh.renderOrder = 5;
    bottleGroup = new THREE.Group();
    bottleGroup.add(bottleMesh);
    bottleGroup.position.set(0, BOTTLE_Y - 2.6, 0.6);
    bottleGroup.scale.setScalar(0.6);
    scene.add(bottleGroup);

    productNameLabel = makeLabel(activeProduct().name);
    productNameLabel.scale.set(3.2, 0.62, 1);
    productNameLabel.position.set(0, BOTTLE_Y - 3.05, 1.3);
    productNameLabel.renderOrder = 8;
    scene.add(productNameLabel);

    shadowPlane = makePlane(
      radialTexture([[0, "rgba(38,42,38,0.3)"], [0.34, "rgba(38,42,38,0.16)"], [0.7, "rgba(38,42,38,0.035)"], [1, "rgba(38,42,38,0)"]]),
      3.2, 0.52, 4
    );
    shadowPlane.position.set(0.06, BOTTLE_Y - BOTTLE_H / 2 - 0.025, 0.2);
    scene.add(shadowPlane);

    contactShadow = makePlane(
      radialTexture([[0, "rgba(31,35,31,0.56)"], [0.28, "rgba(31,35,31,0.3)"], [0.64, "rgba(31,35,31,0.035)"], [1, "rgba(31,35,31,0)"]]),
      2.4, 0.28, 4
    );
    contactShadow.renderOrder = 4.5;
    contactShadow.position.set(0, BOTTLE_Y - BOTTLE_H / 2 - 0.015, 0.24);
    scene.add(contactShadow);

  }

  let rebuildToken = 0;
  let hasBuiltScene = false;
  let initialPlayTimer = null;
  async function rebuildScene() {
    const token = ++rebuildToken;
    const ingredientSnapshot = ingredients.slice();
    const productSnapshot = productSrc;
    const textures = await Promise.all([
      ...ingredientSnapshot.map((ingredient) => loadTex(ingredient.src)),
      loadTex(productSnapshot),
    ]);
    if (token !== rebuildToken) {
      textures.forEach(disposeTexture);
      return;
    }

    if (tl) tl.kill();
    const oldTextures = new Set();
    scene.traverse((object) => {
      if (!object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material.map) oldTextures.add(material.map);
        if (material.uniforms) {
          Object.values(material.uniforms).forEach((uniform) => {
            if (uniform.value && uniform.value.isTexture) oldTextures.add(uniform.value);
          });
        }
        material.dispose();
      });
      if (object.geometry) object.geometry.dispose();
    });
    oldTextures.forEach(disposeTexture);
    scene.clear();
    items.length = 0;
    const bottleTexture = textures.pop();
    buildScene(textures, bottleTexture);
    if (hasBuiltScene) play();
    else hasBuiltScene = true;
  }

  /* ------------------------------------------------------------------ *
   *  Per-frame update
   * ------------------------------------------------------------------ */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });

  function seg(p, i, n, amount) {
    const d = n > 1 ? (i / (n - 1)) * amount : 0;
    return clamp((p - d) / (1 - amount), 0, 1);
  }

  function update(time) {
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // camera parallax: layers at different depths slide against each other
    camera.position.x = pointer.x * 0.55;
    camera.position.y = -pointer.y * 0.4;
    camera.lookAt(0, 0, 0);

    const n = items.length;
    items.forEach((it, i) => {
      const sIn = seg(S.intro, i, n, 0.65);
      const g = easeGather(seg(S.gather, i, n, 0.35));
      const r = easeRelease(seg(S.release, i, n, 0.4));

      const rad = R * (1 - g + r);
      const ang = it.a0 + S.rot;
      const bob = Math.sin(S.rot * 4 + i * 1.3) * 0.08 * sIn * (1 - g);
      const z = 1.2 * Math.sin(Math.PI * g) + 1.0 * Math.sin(Math.PI * r);
      const sc = easePop(sIn) * (1 - 0.72 * g + 0.72 * r);
      const op = Math.min(1, sIn * 3) * (1 - 0.75 * Math.pow(g, 8) + 0.75 * r);

      const x = Math.cos(ang) * rad;
      const y = -Math.sin(ang) * rad + bob;
      it.mesh.position.set(x, y, z);
      it.mesh.scale.setScalar(Math.max(sc, 0.0001));
      it.mesh.rotation.set(-pointer.y * 0.25, pointer.x * 0.35, 1.2 * g - 1.2 * r);
      it.mesh.material.opacity = clamp(op);

      // soft drop shadow, pushed further away the closer the item is to the camera
      const off = 0.1 + 0.14 * z;
      it.shadow.position.set(x + off, y - off * 1.6, z - 0.05);
      it.shadow.scale.setScalar(Math.max(sc, 0.0001));
      it.shadow.rotation.copy(it.mesh.rotation);
      it.shadow.material.opacity = clamp(op) * 0.7;

      const lo = Math.min(S.labels, sIn);
      it.label.position.set(x, y - (it.h * sc) / 2 - 0.3, z);
      const bottleClearance = 1 - S.bottleOp + S.bottleOp * clamp((rad - 3.55) / 0.25);
      it.label.material.opacity = lo * bottleClearance;
    });

    // drifting motes
    const mp = moteGeo.attributes.position;
    for (let i = 0; i < moteBase.length; i++) {
      const m = moteBase[i];
      mp.setXYZ(
        i,
        m.x + Math.sin(time * m.sp + m.ph) * 0.35,
        m.y + Math.cos(time * m.sp * 0.8 + m.ph) * 0.3 + Math.sin(time * 0.2 + m.ph) * 0.2,
        m.z
      );
    }
    mp.needsUpdate = true;
    motes.material.opacity = S.ringIn * 0.34;

    const haloStyle = productAnimation === "halo";
    const haloPulse = haloStyle ? Math.sin(time * 1.15) * 0.035 * S.bottleOp : 0;
    aura.material.opacity = S.aura * (haloStyle ? 0.78 + Math.sin(time * 1.15) * 0.08 * S.bottleOp : 1);
    aura.scale.setScalar(lerp(0.85, 1.08, S.aura) * (1 + haloPulse));

    if (S.burst > 0 && S.burst < 1) {
      particles.visible = true;
      const expansion = 1 - Math.pow(1 - S.burst, 2);
      const positions = particleGeometry.attributes.position;
      const colors = particleGeometry.attributes.color.array;
      for (let i = 0; i < particleDirections.length; i++) {
        const direction = particleDirections[i];
        const radius = particleSpeeds[i] * expansion;
        positions.setXYZ(
          i,
          direction.x * radius,
          direction.y * radius + expansion * 0.45,
          0.95 + direction.z * radius * 0.18
        );
        const flicker = 0.4 + 0.6 * Math.pow((Math.sin(time * 13 + particlePhases[i]) + 1) / 2, 4);
        colors[i * 3] = particleBaseColors[i * 3] * flicker;
        colors[i * 3 + 1] = particleBaseColors[i * 3 + 1] * flicker;
        colors[i * 3 + 2] = particleBaseColors[i * 3 + 2] * flicker;
      }
      positions.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particles.material.opacity = 1 - Math.pow(S.burst, 2);
    } else {
      particles.visible = false;
    }
    const glowExpansion = 1 - Math.pow(1 - S.burst, 2);
    burstGlow.material.opacity = 0.82 * (1 - S.burst) * Math.min(1, S.burst * 8);
    burstGlow.scale.setScalar(lerp(0.35, 1.05, glowExpansion));

    // bottle: rises, swings in like a turntable, then a light sweep passes over it
    const turntable = productAnimation === "turntable";
    const halo = productAnimation === "halo";
    const bob2 = Math.sin(time * (halo ? 1.1 : 1.3)) * (turntable ? 0.06 : halo ? 0.04 : 0.025) * S.bottleOp;
    bottleGroup.position.set(0, BOTTLE_Y + bob2, 0.6);
    const haloBreath = halo ? 1 + Math.sin(time * 1.1) * 0.012 * S.bottleOp : 1;
    bottleGroup.scale.setScalar(lerp(0.12, 1, S.bottle) * haloBreath);
    const sway = halo ? Math.sin(S.turn * TAU) * 0.1 : 0;
    bottleGroup.rotation.y = (turntable ? (1 - S.turn) * -1.25 : sway) + pointer.x * (turntable ? 0.18 : 0.05);
    bottleGroup.rotation.x = -pointer.y * (turntable ? 0.08 : 0.025);
    bottleMat.uniforms.uOpacity.value = S.bottleOp;
    bottleMat.uniforms.uShine.value = turntable || !halo ? S.shine : 0.15 + S.turn * 0.9;
    productNameLabel.material.opacity = S.bottleOp;
    shadowPlane.material.opacity = 0.8 * S.shadow;
    shadowPlane.scale.set(lerp(0.25, 1.05, S.shadow), 1, 1);
    contactShadow.material.opacity = S.shadow;
    contactShadow.scale.set(lerp(0.2, 1, S.shadow), 1, 1);
  }

  /* ------------------------------------------------------------------ *
   *  Timeline (about 7.4 s)
   * ------------------------------------------------------------------ */
  function buildTimeline() {
    const PRODUCT_START = 3.7;
    if (tl) tl.kill();
    resetState();
    tl = gsap.timeline({ paused: true });

    tl.to(S, { ringIn: 1, duration: 0.9, ease: "power2.out" }, 0)
      .to(S, { intro: 1, duration: 1.4, ease: "none" }, 0.1)
      .to(S, { labels: 1, duration: 0.8, ease: "power1.out" }, 0.7)
      .to(S, { rot: TAU, duration: 5.8, ease: "sine.inOut" }, 0.8)
      .to(S, { aura: 0.5, duration: 1.4, ease: "sine.inOut" }, 1.0)
      .to(S, { labels: 0, duration: 0.4, ease: "power1.in" }, 2.0)
      .to(S, { gather: 1, duration: 1.6, ease: "none" }, 2.1)
      // Small green particles disperse upward from the ingredient collision.
      .to(S, { burst: 1, duration: 0.55, ease: "power2.out" }, 3.7);

    if (productAnimation === "turntable") {
      tl.to(S, { bottleOp: 1, duration: 0.9, ease: "power2.out" }, PRODUCT_START)
        .to(S, { bottle: 1, duration: 2.0, ease: "power3.out" }, PRODUCT_START)
        .to(S, { turn: 1, duration: 2.0, ease: "power3.out" }, PRODUCT_START)
        .to(S, { shine: 1.8, duration: 1.6, ease: "power1.inOut" }, PRODUCT_START + 0.25);
    } else if (productAnimation === "halo") {
      tl.to(S, { bottleOp: 1, duration: 1.0, ease: "power2.out" }, PRODUCT_START)
        .to(S, { bottle: 1, duration: 2.0, ease: "power3.out" }, PRODUCT_START)
        .to(S, { turn: 1, duration: 2.2, ease: "sine.inOut" }, PRODUCT_START);
    } else {
      tl.to(S, { bottleOp: 1, duration: 1.0, ease: "power2.out" }, PRODUCT_START)
        .to(S, { bottle: 1, duration: 2.1, ease: "power3.out" }, PRODUCT_START)
        .to(S, { turn: 1, duration: 2.1, ease: "power3.out" }, PRODUCT_START)
        .to(S, { shine: 1.8, duration: 1.6, ease: "power1.inOut" }, PRODUCT_START + 0.25);
    }

    tl.to(S, { aura: 1, duration: 1.2, ease: "sine.out" }, PRODUCT_START)
      .to(S, { shadow: 1, duration: 1.0, ease: "power2.out" }, PRODUCT_START + 0.5)
      // ingredients fly back to the ring
      .to(S, { release: 1, duration: 1.6, ease: "none" }, 5.0)
      .to(S, { labels: 1, duration: 0.7, ease: "power1.out" }, 5.7)
      .to(S, { hold: 1, duration: 0.9 }, 6.7);
  }

  function play() {
    if (initialPlayTimer !== null) {
      clearTimeout(initialPlayTimer);
      initialPlayTimer = null;
    }
    buildTimeline();
    tl.play(0);
  }

  /* ------------------------------------------------------------------ *
   *  Video recording (captures the WebGL canvas directly)
   * ------------------------------------------------------------------ */
  downloadBtn.addEventListener("click", () => {
    if (downloadBtn.disabled || typeof MediaRecorder === "undefined") return;
    const canvas = renderer.domElement;
    const originalPixelRatio = renderer.getPixelRatio();
    const stageSize = stageEl.clientWidth;
    let resolutionRestored = false;
    const restoreResolution = () => {
      if (resolutionRestored) return;
      resolutionRestored = true;
      renderer.setPixelRatio(originalPixelRatio);
      renderer.setSize(stageEl.clientWidth, stageEl.clientWidth, false);
    };

    let stream;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(900, 900, false);
      stream = canvas.captureStream(60);
    } catch (err) {
      restoreResolution();
      alert("Video capture could not start. Try again in a current desktop browser.");
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16000000 });
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream);
      } catch (recordingError) {
        restoreResolution();
        stream.getTracks().forEach((track) => track.stop());
        alert("Video recording could not start: " + recordingError.message);
        return;
      }
    }
    const chunks = [];
    recorder.ondataavailable = (e) => e.data && e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      restoreResolution();
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download Video";
      if (!blob.size) return alert("No video frames were captured. Try running via a local web server.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-reveal-3d.webm";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    };

    downloadBtn.disabled = true;
    downloadBtn.textContent = "Recording...";
    play();
    recorder.start(200);
    setTimeout(() => recorder.state !== "inactive" && recorder.stop(), Math.ceil(tl.duration() * 1000) + 300);
  });

  replayBtn.addEventListener("click", play);

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */
  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    update(clock.getElapsedTime());
    renderer.render(scene, camera);
  }

  rebuildScene()
    .then(() => {
      loadingEl.classList.add("hide");
      tick();
      initialPlayTimer = setTimeout(() => {
        initialPlayTimer = null;
        play();
      }, 1000);
    })
    .catch((err) => {
      console.error(err);
      loadingEl.textContent = "Error: " + (err && err.message ? err.message : "could not load images");
    });
});
