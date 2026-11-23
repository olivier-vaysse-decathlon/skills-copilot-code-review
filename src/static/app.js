document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const registrationModal = document.getElementById("registration-modal");
  const modalActivityName = document.getElementById("modal-activity-name");
  const signupForm = document.getElementById("signup-form");
  const activityInput = document.getElementById("activity");
  const closeRegistrationModal = document.querySelector(".close-modal");

  // Search and filter elements
  const searchInput = document.getElementById("activity-search");
  const searchButton = document.getElementById("search-button");
  const categoryFilters = document.querySelectorAll(".category-filter");
  const dayFilters = document.querySelectorAll(".day-filter");
  const timeFilters = document.querySelectorAll(".time-filter");

  // Authentication elements
  const loginButton = document.getElementById("login-button");
  const userInfo = document.getElementById("user-info");
  const displayName = document.getElementById("display-name");
  const logoutButton = document.getElementById("logout-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginModal = document.querySelector(".close-login-modal");
  const loginMessage = document.getElementById("login-message");
  const manageAnnouncementsButton = document.getElementById("manage-announcements");
  const announcementsDialog = document.getElementById("announcements-dialog");
  const announcementsList = document.getElementById("announcements-list");
  const announcementForm = document.getElementById("announcement-form");
  const announcementFields = document.getElementById("announcement-fields");
  const announcementMessage = document.getElementById("announcement-message");
  const announcementStart = document.getElementById("announcement-start");
  const announcementExpiration = document.getElementById("announcement-expiration");
  const announcementFeedback = document.getElementById("announcements-feedback");
  const saveAnnouncementButton = document.getElementById("save-announcement");
  const announcementRetry = document.getElementById("retry-management");
  let announcements = [];
  let editingAnnouncementId = null;
  let announcementsBusy = false;
  let bannerRequest = 0;
  let managementRequest = 0;

  // Activity categories with corresponding colors
  const activityTypes = {
    sports: { label: "Sports", color: "#e8f5e9", textColor: "#2e7d32" },
    arts: { label: "Arts", color: "#f3e5f5", textColor: "#7b1fa2" },
    academic: { label: "Academic", color: "#e3f2fd", textColor: "#1565c0" },
    community: { label: "Community", color: "#fff3e0", textColor: "#e65100" },
    technology: { label: "Technology", color: "#e8eaf6", textColor: "#3949ab" },
  };

  // State for activities and filters
  let allActivities = {};
  let currentFilter = "all";
  let searchQuery = "";
  let currentDay = "";
  let currentTimeRange = "";

  // Authentication state
  let currentUser = null;

  // Time range mappings for the dropdown
  const timeRanges = {
    morning: { start: "06:00", end: "08:00" }, // Before school hours
    afternoon: { start: "15:00", end: "18:00" }, // After school hours
    weekend: { days: ["Saturday", "Sunday"] }, // Weekend days
  };

  // Initialize filters from active elements
  function initializeFilters() {
    // Initialize day filter
    const activeDayFilter = document.querySelector(".day-filter.active");
    if (activeDayFilter) {
      currentDay = activeDayFilter.dataset.day;
    }

    // Initialize time filter
    const activeTimeFilter = document.querySelector(".time-filter.active");
    if (activeTimeFilter) {
      currentTimeRange = activeTimeFilter.dataset.time;
    }
  }

  // Function to set day filter
  function setDayFilter(day) {
    currentDay = day;

    // Update active class
    dayFilters.forEach((btn) => {
      if (btn.dataset.day === day) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    fetchActivities();
  }

  // Function to set time range filter
  function setTimeRangeFilter(timeRange) {
    currentTimeRange = timeRange;

    // Update active class
    timeFilters.forEach((btn) => {
      if (btn.dataset.time === timeRange) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    fetchActivities();
  }

  // Only the server can establish whether a user is signed in.
  function checkAuthentication() {
    localStorage.removeItem("currentUser");
    loginButton.disabled = true;
    validateUserSession().finally(() => {
      loginButton.disabled = false;
    });
    updateAuthBodyClass();
  }

  // Validate user session with the server
  async function validateUserSession() {
    try {
      const response = await fetch("/auth/check-session", { cache: "no-store" });
      if (response.status === 401) {
        clearAuthentication();
        return;
      }
      if (!response.ok) throw new Error(`Session check failed (${response.status})`);

      // Session is valid, update user data
      const userData = await response.json();
      currentUser = userData;
      updateAuthUI();
    } catch (error) {
      console.error("Error validating session:", error);
      clearAuthentication();
      showMessage("Unable to verify your login. Please sign in again.", "error");
    }
  }

  // Update UI based on authentication state
  function updateAuthUI() {
    manageAnnouncementsButton.classList.toggle("hidden", !currentUser);
    if (currentUser) {
      loginButton.classList.add("hidden");
      userInfo.classList.remove("hidden");
      displayName.textContent = currentUser.display_name;
    } else {
      loginButton.classList.remove("hidden");
      userInfo.classList.add("hidden");
      displayName.textContent = "";
    }

    updateAuthBodyClass();
    // Refresh the activities to update the UI
    fetchActivities();
  }

  // Update body class for CSS targeting
  function updateAuthBodyClass() {
    if (currentUser) {
      document.body.classList.remove("not-authenticated");
    } else {
      document.body.classList.add("not-authenticated");
    }
  }

  // Login function
  async function login(username, password) {
    try {
      const response = await fetch(
        "/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showLoginMessage(
          data.detail || "Invalid username or password",
          "error"
        );
        return false;
      }

      // Login successful
      currentUser = data;
      updateAuthUI();
      closeLoginModalHandler();
      showMessage(`Welcome, ${currentUser.display_name}!`, "success");
      return true;
    } catch (error) {
      console.error("Error during login:", error);
      showLoginMessage("Login failed. Please try again.", "error");
      return false;
    }
  }

  // Logout function
  function clearAuthentication() {
    currentUser = null;
    managementRequest++;
    localStorage.removeItem("currentUser");
    if (announcementsDialog.open) announcementsDialog.close();
    announcements = [];
    announcementsList.replaceChildren();
    resetAnnouncementEditor();
    updateAuthUI();
  }

  async function logout() {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(`Logout failed (${response.status})`);
      clearAuthentication();
      showMessage("You have been logged out.", "info");
    } catch (error) {
      console.error("Error logging out:", error);
      showMessage("Could not log out. Please try again.", "error");
    }
  }

  function showAnnouncementFeedback(text, type) {
    announcementFeedback.textContent = text;
    announcementFeedback.className = `message ${type}`;
  }

  async function announcementRequest(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    if (response.status === 401) {
      clearAuthentication();
      showMessage("Your session has expired. Please sign in again.", "error");
      throw new Error("Announcement management requires a valid session");
    }
    if (!response.ok) throw new Error(`Announcement request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  }

  async function refreshAnnouncementBanner() {
    const request = ++bannerRequest;
    const banner = document.getElementById("announcement-banner");
    const errorMessage = document.getElementById("announcement-load-error");
    try {
      const response = await fetch("/announcements", { cache: "no-store" });
      if (!response.ok) throw new Error(`Announcement fetch failed (${response.status})`);
      const activeAnnouncements = await response.json();
      if (request !== bannerRequest) return;
      banner.replaceChildren();
      activeAnnouncements.forEach((announcement) => {
        const notice = document.createElement("p");
        notice.textContent = announcement.message;
        banner.appendChild(notice);
      });
      banner.classList.toggle("hidden", activeAnnouncements.length === 0);
      errorMessage.classList.add("hidden");
    } catch (error) {
      console.error("Error loading public announcements:", error);
      if (request !== bannerRequest) return;
      banner.replaceChildren();
      banner.classList.add("hidden");
      errorMessage.classList.remove("hidden");
    }
  }

  function resetAnnouncementEditor() {
    editingAnnouncementId = null;
    announcementForm.reset();
    announcementMessage.setCustomValidity("");
    announcementExpiration.setCustomValidity("");
    document.getElementById("announcement-editor-title").textContent = "New announcement";
    saveAnnouncementButton.textContent = "Publish announcement";
    document.getElementById("cancel-announcement-edit").textContent = "Clear";
  }

  function announcementButton(text, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = className;
    button.disabled = announcementsBusy;
    button.addEventListener("click", handler);
    return button;
  }

  function renderAnnouncements() {
    announcementsList.replaceChildren();
    document.getElementById("announcement-count").textContent = announcements.length;
    if (!announcements.length) {
      const empty = document.createElement("p");
      empty.className = "announcement-empty";
      empty.textContent = "A fresh noticeboard. Create your first announcement to share something with the school.";
      announcementsList.appendChild(empty);
    }
    const today = new Date().toISOString().slice(0, 10);
    const formatDate = (value) => new Date(`${value}T00:00:00Z`).toLocaleDateString(
      undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
    );
    announcements.forEach((announcement) => {
      const status = announcement.expires_on < today ? "expired"
        : announcement.starts_on && announcement.starts_on > today ? "scheduled" : "live";
      const card = document.createElement("article");
      card.className = "announcement-card";
      const badge = document.createElement("span");
      badge.className = `announcement-status ${status}`;
      badge.textContent = { live: "Live now", scheduled: "Scheduled", expired: "Expired" }[status];
      const message = document.createElement("p");
      message.className = "announcement-card-message";
      message.textContent = announcement.message;
      const dates = document.createElement("p");
      dates.className = "announcement-card-dates";
      dates.textContent = `${announcement.starts_on ? formatDate(announcement.starts_on) : "Immediately"} - ${formatDate(announcement.expires_on)} (UTC)`;
      const actions = document.createElement("div");
      actions.className = "announcement-card-actions";
      actions.append(
        announcementButton("Edit", "quiet-button", () => {
          if (announcementsBusy) return;
          editingAnnouncementId = announcement.id;
          announcementMessage.value = announcement.message;
          announcementStart.value = announcement.starts_on || "";
          announcementExpiration.value = announcement.expires_on;
          announcementMessage.setCustomValidity("");
          announcementExpiration.setCustomValidity("");
          document.getElementById("announcement-editor-title").textContent = "Edit announcement";
          saveAnnouncementButton.textContent = "Save changes";
          document.getElementById("cancel-announcement-edit").textContent = "Cancel edit";
          announcementFeedback.classList.add("hidden");
          announcementMessage.focus();
        }),
        announcementButton("Delete", "danger-button", () => {
          if (announcementsBusy) return;
          const prompt = document.createElement("span");
          prompt.textContent = "Permanently delete this message?";
          const confirm = announcementButton("Delete permanently", "danger-button", () => deleteAnnouncement(announcement.id));
          actions.replaceChildren(prompt, confirm, announcementButton("Keep", "quiet-button", renderAnnouncements));
          confirm.focus();
        })
      );
      card.append(badge, message, dates, actions);
      announcementsList.appendChild(card);
    });
  }

  async function loadManagedAnnouncements() {
    const request = ++managementRequest;
    announcementsList.textContent = "Loading announcements...";
    announcementRetry.classList.add("hidden");
    announcementFields.disabled = true;
    document.getElementById("new-announcement").disabled = true;
    try {
      const data = await announcementRequest("/announcements/manage");
      if (request !== managementRequest || !currentUser || !announcementsDialog.open) return;
      announcements = data;
      renderAnnouncements();
    } catch (error) {
      console.error("Error loading announcement management:", error);
      if (request !== managementRequest) return;
      announcementsList.textContent = "Announcements could not be loaded.";
      announcementRetry.classList.remove("hidden");
    } finally {
      if (request === managementRequest) {
        announcementFields.disabled = false;
        document.getElementById("new-announcement").disabled = false;
      }
    }
  }

  function setAnnouncementsBusy(busy) {
    announcementsBusy = busy;
    announcementFields.disabled = busy;
    document.getElementById("new-announcement").disabled = busy;
    document.getElementById("close-announcements").disabled = busy;
    announcementsDialog.setAttribute("aria-busy", String(busy));
    announcementsList.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
  }

  async function deleteAnnouncement(id) {
    if (announcementsBusy) return;
    setAnnouncementsBusy(true);
    try {
      await announcementRequest(`/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
      announcements = announcements.filter((announcement) => announcement.id !== id);
      if (editingAnnouncementId === id) resetAnnouncementEditor();
      renderAnnouncements();
      showAnnouncementFeedback("Announcement deleted.", "success");
      await refreshAnnouncementBanner();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      showAnnouncementFeedback("Could not delete the announcement. Please try again.", "error");
    } finally {
      setAnnouncementsBusy(false);
      document.getElementById("new-announcement").focus();
    }
  }

  announcementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (announcementsBusy) return;
    announcementMessage.setCustomValidity(announcementMessage.value.trim() ? "" : "Enter a message.");
    announcementExpiration.setCustomValidity(
      announcementStart.value && announcementStart.value > announcementExpiration.value
        ? "Expiration must be on or after the start date." : ""
    );
    if (!announcementForm.reportValidity()) return;
    const id = editingAnnouncementId;
    setAnnouncementsBusy(true);
    saveAnnouncementButton.textContent = "Saving...";
    try {
      const saved = await announcementRequest(id ? `/announcements/${encodeURIComponent(id)}` : "/announcements", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: announcementMessage.value.trim(),
          starts_on: announcementStart.value || null,
          expires_on: announcementExpiration.value,
        }),
      });
      announcements = [saved, ...announcements.filter((announcement) => announcement.id !== saved.id)]
        .sort((a, b) => b.expires_on.localeCompare(a.expires_on));
      resetAnnouncementEditor();
      renderAnnouncements();
      showAnnouncementFeedback(id ? "Changes saved." : "Announcement created.", "success");
      await refreshAnnouncementBanner();
    } catch (error) {
      console.error("Error saving announcement:", error);
      showAnnouncementFeedback("Could not save the announcement. Please try again.", "error");
    } finally {
      setAnnouncementsBusy(false);
      saveAnnouncementButton.textContent = editingAnnouncementId ? "Save changes" : "Publish announcement";
    }
  });

  announcementMessage.addEventListener("input", () => announcementMessage.setCustomValidity(""));
  [announcementStart, announcementExpiration].forEach((input) => {
    input.addEventListener("input", () => announcementExpiration.setCustomValidity(""));
  });
  manageAnnouncementsButton.addEventListener("click", () => {
    if (!currentUser) return;
    resetAnnouncementEditor();
    announcementFeedback.classList.add("hidden");
    announcementsDialog.showModal();
    loadManagedAnnouncements();
  });
  document.getElementById("close-announcements").addEventListener("click", () => announcementsDialog.close());
  announcementsDialog.addEventListener("cancel", (event) => {
    if (announcementsBusy) event.preventDefault();
  });
  document.getElementById("new-announcement").addEventListener("click", () => {
    resetAnnouncementEditor();
    announcementMessage.focus();
  });
  document.getElementById("cancel-announcement-edit").addEventListener("click", resetAnnouncementEditor);
  announcementRetry.addEventListener("click", loadManagedAnnouncements);
  document.getElementById("retry-announcements").addEventListener("click", refreshAnnouncementBanner);
  refreshAnnouncementBanner();
  setInterval(refreshAnnouncementBanner, 60000);

  // Show message in login modal
  function showLoginMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.className = `message ${type}`;
    loginMessage.classList.remove("hidden");
  }

  // Open login modal
  function openLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.classList.add("show");
    loginMessage.classList.add("hidden");
    loginForm.reset();
  }

  // Close login modal
  function closeLoginModalHandler() {
    loginModal.classList.remove("show");
    setTimeout(() => {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }, 300);
  }

  // Event listeners for authentication
  loginButton.addEventListener("click", openLoginModal);
  logoutButton.addEventListener("click", logout);
  closeLoginModal.addEventListener("click", closeLoginModalHandler);

  // Close login modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModalHandler();
    }
  });

  // Handle login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    await login(username, password);
  });

  // Show loading skeletons
  function showLoadingSkeletons() {
    activitiesList.innerHTML = "";

    // Create more skeleton cards to fill the screen since they're smaller now
    for (let i = 0; i < 9; i++) {
      const skeletonCard = document.createElement("div");
      skeletonCard.className = "skeleton-card";
      skeletonCard.innerHTML = `
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-text short"></div>
        <div style="margin-top: 8px;">
          <div class="skeleton-line" style="height: 6px;"></div>
          <div class="skeleton-line skeleton-text short" style="height: 8px; margin-top: 3px;"></div>
        </div>
        <div style="margin-top: auto;">
          <div class="skeleton-line" style="height: 24px; margin-top: 8px;"></div>
        </div>
      `;
      activitiesList.appendChild(skeletonCard);
    }
  }

  // Format schedule for display - handles both old and new format
  function formatSchedule(details) {
    // If schedule_details is available, use the structured data
    if (details.schedule_details) {
      const days = details.schedule_details.days.join(", ");

      // Convert 24h time format to 12h AM/PM format for display
      const formatTime = (time24) => {
        const [hours, minutes] = time24.split(":").map((num) => parseInt(num));
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
        return `${displayHours}:${minutes
          .toString()
          .padStart(2, "0")} ${period}`;
      };

      const startTime = formatTime(details.schedule_details.start_time);
      const endTime = formatTime(details.schedule_details.end_time);

      return `${days}, ${startTime} - ${endTime}`;
    }

    // Fallback to the string format if schedule_details isn't available
    return details.schedule;
  }

  // Function to determine activity type (this would ideally come from backend)
  function getActivityType(activityName, description) {
    const name = activityName.toLowerCase();
    const desc = description.toLowerCase();

    if (
      name.includes("soccer") ||
      name.includes("basketball") ||
      name.includes("sport") ||
      name.includes("fitness") ||
      desc.includes("team") ||
      desc.includes("game") ||
      desc.includes("athletic")
    ) {
      return "sports";
    } else if (
      name.includes("art") ||
      name.includes("music") ||
      name.includes("theater") ||
      name.includes("drama") ||
      desc.includes("creative") ||
      desc.includes("paint")
    ) {
      return "arts";
    } else if (
      name.includes("science") ||
      name.includes("math") ||
      name.includes("academic") ||
      name.includes("study") ||
      name.includes("olympiad") ||
      desc.includes("learning") ||
      desc.includes("education") ||
      desc.includes("competition")
    ) {
      return "academic";
    } else if (
      name.includes("volunteer") ||
      name.includes("community") ||
      desc.includes("service") ||
      desc.includes("volunteer")
    ) {
      return "community";
    } else if (
      name.includes("computer") ||
      name.includes("coding") ||
      name.includes("tech") ||
      name.includes("robotics") ||
      desc.includes("programming") ||
      desc.includes("technology") ||
      desc.includes("digital") ||
      desc.includes("robot")
    ) {
      return "technology";
    }

    // Default to "academic" if no match
    return "academic";
  }

  // Function to fetch activities from API with optional day and time filters
  async function fetchActivities() {
    // Show loading skeletons first
    showLoadingSkeletons();

    try {
      // Build query string with filters if they exist
      let queryParams = [];

      // Handle day filter
      if (currentDay) {
        queryParams.push(`day=${encodeURIComponent(currentDay)}`);
      }

      // Handle time range filter
      if (currentTimeRange) {
        const range = timeRanges[currentTimeRange];

        // Handle weekend special case
        if (currentTimeRange === "weekend") {
          // Don't add time parameters for weekend filter
          // Weekend filtering will be handled on the client side
        } else if (range) {
          // Add time parameters for before/after school
          queryParams.push(`start_time=${encodeURIComponent(range.start)}`);
          queryParams.push(`end_time=${encodeURIComponent(range.end)}`);
        }
      }

      const queryString =
        queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const response = await fetch(`/activities${queryString}`);
      const activities = await response.json();

      // Save the activities data
      allActivities = activities;

      // Apply search and filter, and handle weekend filter in client
      displayFilteredActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Function to display filtered activities
  function displayFilteredActivities() {
    // Clear the activities list
    activitiesList.innerHTML = "";

    // Apply client-side filtering - this handles category filter and search, plus weekend filter
    let filteredActivities = {};

    Object.entries(allActivities).forEach(([name, details]) => {
      const activityType = getActivityType(name, details.description);

      // Apply category filter
      if (currentFilter !== "all" && activityType !== currentFilter) {
        return;
      }

      // Apply weekend filter if selected
      if (currentTimeRange === "weekend" && details.schedule_details) {
        const activityDays = details.schedule_details.days;
        const isWeekendActivity = activityDays.some((day) =>
          timeRanges.weekend.days.includes(day)
        );

        if (!isWeekendActivity) {
          return;
        }
      }

      // Apply search filter
      const searchableContent = [
        name.toLowerCase(),
        details.description.toLowerCase(),
        formatSchedule(details).toLowerCase(),
      ].join(" ");

      if (
        searchQuery &&
        !searchableContent.includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      // Activity passed all filters, add to filtered list
      filteredActivities[name] = details;
    });

    // Check if there are any results
    if (Object.keys(filteredActivities).length === 0) {
      activitiesList.innerHTML = `
        <div class="no-results">
          <h4>No activities found</h4>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      `;
      return;
    }

    // Display filtered activities
    Object.entries(filteredActivities).forEach(([name, details]) => {
      renderActivityCard(name, details);
    });
  }

  // Function to render a single activity card
  function renderActivityCard(name, details) {
    const activityCard = document.createElement("div");
    activityCard.className = "activity-card";

    // Calculate spots and capacity
    const totalSpots = details.max_participants;
    const takenSpots = details.participants.length;
    const spotsLeft = totalSpots - takenSpots;
    const capacityPercentage = (takenSpots / totalSpots) * 100;
    const isFull = spotsLeft <= 0;

    // Determine capacity status class
    let capacityStatusClass = "capacity-available";
    if (isFull) {
      capacityStatusClass = "capacity-full";
    } else if (capacityPercentage >= 75) {
      capacityStatusClass = "capacity-near-full";
    }

    // Determine activity type
    const activityType = getActivityType(name, details.description);
    const typeInfo = activityTypes[activityType];

    // Format the schedule using the new helper function
    const formattedSchedule = formatSchedule(details);

    // Create activity tag
    const tagHtml = `
      <span class="activity-tag" style="background-color: ${typeInfo.color}; color: ${typeInfo.textColor}">
        ${typeInfo.label}
      </span>
    `;

    // Create capacity indicator
    const capacityIndicator = `
      <div class="capacity-container ${capacityStatusClass}">
        <div class="capacity-bar-bg">
          <div class="capacity-bar-fill" style="width: ${capacityPercentage}%"></div>
        </div>
        <div class="capacity-text">
          <span>${takenSpots} enrolled</span>
          <span>${spotsLeft} spots left</span>
        </div>
      </div>
    `;

    activityCard.innerHTML = `
      ${tagHtml}
      <h4>${name}</h4>
      <p>${details.description}</p>
      <p class="tooltip">
        <strong>Schedule:</strong> ${formattedSchedule}
        <span class="tooltip-text">Regular meetings at this time throughout the semester</span>
      </p>
      ${capacityIndicator}
      <div class="participants-list">
        <h5>Current Participants:</h5>
        <ul>
          ${details.participants
            .map(
              (email) => `
            <li>
              ${email}
              ${
                currentUser
                  ? `
                <span class="delete-participant tooltip" data-activity="${name}" data-email="${email}">
                  ✖
                  <span class="tooltip-text">Unregister this student</span>
                </span>
              `
                  : ""
              }
            </li>
          `
            )
            .join("")}
        </ul>
      </div>
      <div class="activity-card-actions">
        ${
          currentUser
            ? `
          <button class="register-button" data-activity="${name}" ${
                isFull ? "disabled" : ""
              }>
            ${isFull ? "Activity Full" : "Register Student"}
          </button>
        `
            : `
          <div class="auth-notice">
            Teachers can register students.
          </div>
        `
        }
      </div>
    `;

    // Add click handlers for delete buttons
    const deleteButtons = activityCard.querySelectorAll(".delete-participant");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });

    // Add click handler for register button (only when authenticated)
    if (currentUser) {
      const registerButton = activityCard.querySelector(".register-button");
      if (!isFull) {
        registerButton.addEventListener("click", () => {
          openRegistrationModal(name);
        });
      }
    }

    activitiesList.appendChild(activityCard);
  }

  // Event listeners for search and filter
  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    displayFilteredActivities();
  });

  searchButton.addEventListener("click", (event) => {
    event.preventDefault();
    searchQuery = searchInput.value;
    displayFilteredActivities();
  });

  // Add event listeners to category filter buttons
  categoryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      categoryFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current filter and display filtered activities
      currentFilter = button.dataset.category;
      displayFilteredActivities();
    });
  });

  // Add event listeners to day filter buttons
  dayFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      dayFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current day filter and fetch activities
      currentDay = button.dataset.day;
      fetchActivities();
    });
  });

  // Add event listeners for time filter buttons
  timeFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      timeFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current time filter and fetch activities
      currentTimeRange = button.dataset.time;
      fetchActivities();
    });
  });

  // Open registration modal
  function openRegistrationModal(activityName) {
    modalActivityName.textContent = activityName;
    activityInput.value = activityName;
    registrationModal.classList.remove("hidden");
    // Add slight delay to trigger animation
    setTimeout(() => {
      registrationModal.classList.add("show");
    }, 10);
  }

  // Close registration modal
  function closeRegistrationModalHandler() {
    registrationModal.classList.remove("show");
    setTimeout(() => {
      registrationModal.classList.add("hidden");
      signupForm.reset();
    }, 300);
  }

  // Event listener for close button
  closeRegistrationModal.addEventListener(
    "click",
    closeRegistrationModalHandler
  );

  // Close modal when clicking outside of it
  window.addEventListener("click", (event) => {
    if (event.target === registrationModal) {
      closeRegistrationModalHandler();
    }
  });

  // Create and show confirmation dialog
  function showConfirmationDialog(message, confirmCallback) {
    // Create the confirmation dialog if it doesn't exist
    let confirmDialog = document.getElementById("confirm-dialog");
    if (!confirmDialog) {
      confirmDialog = document.createElement("div");
      confirmDialog.id = "confirm-dialog";
      confirmDialog.className = "modal hidden";
      confirmDialog.innerHTML = `
        <div class="modal-content">
          <h3>Confirm Action</h3>
          <p id="confirm-message"></p>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button id="cancel-button" class="cancel-btn">Cancel</button>
            <button id="confirm-button" class="confirm-btn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmDialog);

      // Style the buttons
      const cancelBtn = confirmDialog.querySelector("#cancel-button");
      const confirmBtn = confirmDialog.querySelector("#confirm-button");

      cancelBtn.style.backgroundColor = "#f1f1f1";
      cancelBtn.style.color = "#333";

      confirmBtn.style.backgroundColor = "#dc3545";
      confirmBtn.style.color = "white";
    }

    // Set the message
    const confirmMessage = document.getElementById("confirm-message");
    confirmMessage.textContent = message;

    // Show the dialog
    confirmDialog.classList.remove("hidden");
    setTimeout(() => {
      confirmDialog.classList.add("show");
    }, 10);

    // Handle button clicks
    const cancelButton = document.getElementById("cancel-button");
    const confirmButton = document.getElementById("confirm-button");

    // Remove any existing event listeners
    const newCancelButton = cancelButton.cloneNode(true);
    const newConfirmButton = confirmButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    // Add new event listeners
    newCancelButton.addEventListener("click", () => {
      confirmDialog.classList.remove("show");
      setTimeout(() => {
        confirmDialog.classList.add("hidden");
      }, 300);
    });

    newConfirmButton.addEventListener("click", () => {
      confirmCallback();
      confirmDialog.classList.remove("show");
      setTimeout(() => {
        confirmDialog.classList.add("hidden");
      }, 300);
    });

    // Close when clicking outside
    confirmDialog.addEventListener("click", (event) => {
      if (event.target === confirmDialog) {
        confirmDialog.classList.remove("show");
        setTimeout(() => {
          confirmDialog.classList.add("hidden");
        }, 300);
      }
    });
  }

  // Handle unregistration with confirmation
  async function handleUnregister(event) {
    // Check if user is authenticated
    if (!currentUser) {
      showMessage(
        "You must be logged in as a teacher to unregister students.",
        "error"
      );
      return;
    }

    const activity = event.target.dataset.activity;
    const email = event.target.dataset.email;

    // Show confirmation dialog
    showConfirmationDialog(
      `Are you sure you want to unregister ${email} from ${activity}?`,
      async () => {
        try {
          const response = await fetch(
            `/activities/${encodeURIComponent(
              activity
            )}/unregister?email=${encodeURIComponent(
              email
            )}&teacher_username=${encodeURIComponent(currentUser.username)}`,
            {
              method: "POST",
            }
          );

          const result = await response.json();

          if (response.ok) {
            showMessage(result.message, "success");
            // Refresh the activities list
            fetchActivities();
          } else {
            showMessage(result.detail || "An error occurred", "error");
          }
        } catch (error) {
          showMessage("Failed to unregister. Please try again.", "error");
          console.error("Error unregistering:", error);
        }
      }
    );
  }

  // Show message function
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Check if user is authenticated
    if (!currentUser) {
      showMessage(
        "You must be logged in as a teacher to register students.",
        "error"
      );
      return;
    }

    const email = document.getElementById("email").value;
    const activity = activityInput.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(
          email
        )}&teacher_username=${encodeURIComponent(currentUser.username)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        closeRegistrationModalHandler();
        // Refresh the activities list after successful signup
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Expose filter functions to window for future UI control
  window.activityFilters = {
    setDayFilter,
    setTimeRangeFilter,
  };

  // Initialize app
  checkAuthentication();
  initializeFilters();
  fetchActivities();
});
