(function () {
  const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_GENDERS = ["female", "male", "non_binary", "prefer_not_to_say", "other"];
  const REQUEST_TIMEOUT_MS = 12000;
  let pageAnimated = false;

  function hasGsap() {
    return typeof window.gsap !== "undefined";
  }

  function animatePage() {
    if (pageAnimated) return;
    pageAnimated = true;
    if (!hasGsap()) return;

    const brand = document.querySelector("[data-anim='brand']");
    const panel = document.querySelector("[data-anim='panel']");
    const rail = document.querySelector("[data-anim='rail']");

    const tl = window.gsap.timeline({ defaults: { ease: "power3.out" } });
    if (brand) {
      tl.from(brand, { x: -18, opacity: 0, duration: 0.58 });
      tl.from(
        brand.querySelectorAll(
          ".setup-brand-title, .setup-brand-copy, .setup-metric, .setup-steps li, .setup-pill"
        ),
        {
          y: 12,
          opacity: 0,
          duration: 0.36,
          stagger: 0.06,
        },
        "-=0.34"
      );
    }

    if (panel) {
      tl.from(
        panel,
        {
          y: 22,
          opacity: 0,
          scale: 0.99,
          duration: 0.62,
        },
        "-=0.28"
      );
      tl.from(
        panel.querySelectorAll(".setup-head, .setup-field, .setup-actions"),
        {
          y: 10,
          opacity: 0,
          duration: 0.3,
          stagger: 0.05,
        },
        "-=0.28"
      );
    }

    if (rail) {
      tl.from(
        rail,
        {
          x: 18,
          opacity: 0,
          duration: 0.44,
        },
        "-=0.26"
      );
      tl.from(
        rail.querySelectorAll(".setup-live, .setup-rules"),
        {
          y: 8,
          opacity: 0,
          duration: 0.3,
          stagger: 0.08,
        },
        "-=0.24"
      );
    }
  }

  function setStatus(message, type) {
    const statusEl = document.getElementById("setup-status");
    if (!statusEl) return;

    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-error", "is-success");
    if (type === "error") statusEl.classList.add("is-error");
    if (type === "success") statusEl.classList.add("is-success");
  }

  function setPreview(previewEl, username, avatarFile) {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile);
      previewEl.innerHTML = `<img src="${url}" alt="Profile photo preview" />`;
      return;
    }

    const initials = window.ClashlyProfiles.initialsFromUsername(username || "cl");
    previewEl.textContent = initials;
  }

  function validateAvatarFile(file) {
    if (!file) return "";

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return "Unsupported profile photo format. Use JPG, PNG, WEBP, or GIF.";
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return "Profile photo is too large. Maximum size is 5MB.";
    }

    return "";
  }

  function getDateBounds() {
    const now = new Date();
    return {
      max: now.toISOString().split("T")[0],
    };
  }

  function resolveDateOfBirth(value) {
    const normalized = (value || "").trim();
    if (!normalized) {
      return null;
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const { max } = getDateBounds();
    if (normalized > max) {
      return null;
    }

    return normalized;
  }

  function resolveGender(value) {
    const normalized = (value || "").trim();
    if (!ALLOWED_GENDERS.includes(normalized)) {
      return null;
    }
    return normalized;
  }

  function setAvatarHandle(handleEl, username) {
    if (!handleEl) return;
    const normalized = window.ClashlyProfiles.normalizeUsername(username || "");
    handleEl.textContent = `@${normalized || "clashly"}`;
  }

  function redirectToHome() {
    window.location.replace("index.html");
  }

  function withTimeout(promise, errorMessage, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(errorMessage));
        }, timeoutMs || REQUEST_TIMEOUT_MS);
      }),
    ]);
  }

  async function resolveCurrentUser() {
    const sessionState = await withTimeout(
      window.ClashlySession.resolveSession(),
      "Timed out while checking your account session."
    );
    if (sessionState.error) {
      throw sessionState.error;
    }
    if (!sessionState.user) {
      window.location.replace("auth.html");
      return null;
    }
    return sessionState.user;
  }

  async function validateUsername(username, userId) {
    const normalized = window.ClashlyProfiles.normalizeUsername(username);
    if (!window.ClashlyProfiles.isUsernameValid(normalized)) {
      throw new Error("Username must be 3-20 characters using lowercase letters, numbers, or underscore.");
    }

    const availability = await window.ClashlyProfiles.isUsernameAvailable(normalized, userId);
    if (availability.error) {
      throw availability.error;
    }

    if (!availability.available) {
      throw new Error("Username already exists. Choose another one.");
    }

    return normalized;
  }

  function bindAvatarPreview(usernameInput, avatarInput, previewEl, handleEl) {
    const refresh = () => {
      const file = avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null;
      const fileError = validateAvatarFile(file);
      if (fileError) {
        avatarInput.value = "";
        setStatus(fileError, "error");
        setPreview(previewEl, usernameInput.value, null);
        setAvatarHandle(handleEl, usernameInput.value);
        return;
      }
      setPreview(previewEl, usernameInput.value, file);
      setAvatarHandle(handleEl, usernameInput.value);
    };

    usernameInput.addEventListener("input", refresh);
    avatarInput.addEventListener("change", refresh);
    refresh();
  }

  function bindBioCounter(bioInput, counterEl) {
    if (!bioInput || !counterEl) return;
    const sync = () => {
      const count = bioInput.value ? bioInput.value.length : 0;
      counterEl.textContent = `${count}/160`;
    };
    bioInput.addEventListener("input", sync);
    sync();
  }

  async function initProfileSetupPage() {
    const form = document.getElementById("profile-setup-form");
    const submitBtn = document.getElementById("setup-submit");
    if (!form) return;
    window.__clashlyProfileSetupBound = true;

    if (!window.ClashlyProfiles || !window.ClashlySession) {
      setStatus("App scripts did not load correctly. Refresh and try again.", "error");
      return;
    }

    try {
      animatePage();

      const usernameInput = document.getElementById("setup-username");
      const bioInput = document.getElementById("setup-bio");
      const bioCountEl = document.getElementById("setup-bio-count");
      const dobInput = document.getElementById("setup-dob");
      const genderInput = document.getElementById("setup-gender");
      const avatarInput = document.getElementById("setup-avatar");
      const previewEl = document.getElementById("setup-avatar-preview");
      const avatarHandleEl = document.getElementById("setup-avatar-handle");
      if (
        !usernameInput ||
        !bioInput ||
        !dobInput ||
        !genderInput ||
        !avatarInput ||
        !previewEl ||
        !submitBtn
      ) {
        setStatus("Setup form is incomplete. Reload this page.", "error");
        return;
      }

      bindAvatarPreview(usernameInput, avatarInput, previewEl, avatarHandleEl);
      bindBioCounter(bioInput, bioCountEl);
      const bounds = getDateBounds();
      dobInput.max = bounds.max;
      let existingProfileData = null;
      let userPromise = resolveCurrentUser();

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setStatus("", "");

        const rawUsername = usernameInput.value;
        const bio = bioInput.value;
        const dateOfBirth = resolveDateOfBirth(dobInput.value);
        const gender = resolveGender(genderInput.value);
        const avatarFile = avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null;
        const avatarError = validateAvatarFile(avatarFile);
        if (avatarError) {
          setStatus(avatarError, "error");
          return;
        }
        if (!dateOfBirth) {
          setStatus("Date of birth cannot be in the future.", "error");
          return;
        }
        if (!gender) {
          setStatus("Select a valid gender option.", "error");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        try {
          setStatus("Checking account...", "");
          const user = await withTimeout(userPromise, "Timed out while checking your account.");
          if (!user) {
            throw new Error("Your session expired. Log in again.");
          }

          setStatus("Validating username...", "");
          const normalizedUsername = await withTimeout(
            validateUsername(rawUsername, user.id),
            "Timed out while validating username."
          );

          let avatarUrl = existingProfileData && existingProfileData.avatar_url
            ? existingProfileData.avatar_url
            : "";

          if (avatarFile) {
            setStatus("Uploading profile photo...", "");
            const uploadResult = await withTimeout(
              window.ClashlyProfiles.uploadAvatar(avatarFile, user.id),
              "Timed out while uploading profile photo.",
              20000
            );
            if (uploadResult.error) {
              throw uploadResult.error;
            }
            avatarUrl = uploadResult.avatarUrl;
          }

          setStatus("Saving profile...", "");
          const saveResult = await withTimeout(
            window.ClashlyProfiles.upsertProfile({
              userId: user.id,
              username: normalizedUsername,
              bio,
              dateOfBirth,
              gender,
              avatarUrl,
            }),
            "Timed out while saving profile."
          );

          if (saveResult.error) {
            if (saveResult.error.code === "23505") {
              throw new Error("Username already exists. Choose another one.");
            }
            throw saveResult.error;
          }

          setStatus("Profile saved. Redirecting to Clashe...", "success");
          redirectToHome();
        } catch (error) {
          const message = window.ClashlyUtils.reportError("Profile setup submit failed.", error, "Unable to complete setup.");
          if (message.toLowerCase().includes("date_of_birth")) {
            setStatus("Database schema is outdated. Run supabase/phase2_setup.sql and try again.", "error");
            return;
          }
          setStatus(message, "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Finish setup";
        }
      });

      (async () => {
        try {
          const user = await withTimeout(userPromise, "Timed out while loading your account.");
          if (!user) return;

          const existingProfile = await withTimeout(
            window.ClashlyProfiles.getProfileById(user.id),
            "Timed out while loading current profile."
          );
          if (existingProfile.error) {
            setStatus(
              window.ClashlyUtils.reportError("Profile preload failed.", existingProfile.error, "Unable to load current profile."),
              "error"
            );
            return;
          }

          existingProfileData = existingProfile.profile || null;
          if (!existingProfileData) return;

          usernameInput.value = existingProfileData.username || "";
          bioInput.value = existingProfileData.bio || "";
          dobInput.value = existingProfileData.date_of_birth || "";
          genderInput.value = existingProfileData.gender || "prefer_not_to_say";
          if (bioCountEl) {
            bioCountEl.textContent = `${bioInput.value.length}/160`;
          }
          if (existingProfileData.avatar_url) {
            previewEl.innerHTML = `<img src="${existingProfileData.avatar_url}" alt="Current profile avatar" />`;
          } else {
            setPreview(previewEl, existingProfileData.username, null);
          }
          setAvatarHandle(avatarHandleEl, existingProfileData.username || "");
        } catch (error) {
          const message = window.ClashlyUtils.reportError("Profile preload failed.", error, "Unable to load current profile.");
          setStatus(message, "error");
        }
      })();
    } catch (error) {
      const message = window.ClashlyUtils.reportError("Profile setup init failed.", error, "Profile setup failed to initialize.");
      setStatus(message, "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initProfileSetupPage();
    });
  } else {
    initProfileSetupPage();
  }
})();
