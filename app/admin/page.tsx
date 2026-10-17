"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
// papaparse (~6 KB), xlsx (~135 KB) and the Supabase browser client (~48 KB) are
// loaded on demand inside the handlers that need them, so they are not part of
// the /admin first-load bundle.
import type { DbEvent, DbPortalConfig, AdminParticipantRow, DbTeamMember } from "@/types/certificate";
import { formatFullName, cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ArrowRight,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Edit3,
  ExternalLink,
  Search,
  Download,
  Send,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Sparkles,
  ShieldCheck,
  Radio,
  FileSpreadsheet,
  X,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  ImageIcon,
  GraduationCap,
  Briefcase,
  Upload,
  Camera,
  Loader2,
  Link2,
  Table2,
  AlertCircle,
  AlertTriangle,
  LayoutDashboard,
} from "lucide-react";

export type AdminTab = "overview" | "events" | "registrations" | "team" | "settings";

// ── Helpers ───────────────────────────────────────────────────
function formatDate(iso?: string | null): string {
  if (!iso || !iso.trim() || iso.toLowerCase() === "tba") {
    return "To be announced";
  }
  try {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "To be announced";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "ST";
}

// ── Main Admin Page ───────────────────────────────────────────
function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation State
  const [activeTab, setActiveTabState] = useState<AdminTab>("overview");

  const setActiveTab = useCallback((tab: AdminTab) => {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
      window.dispatchEvent(new CustomEvent("admin-tab-change", { detail: tab }));
    }
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab") as AdminTab | null;
    if (
      tabParam &&
      ["overview", "events", "registrations", "team", "settings"].includes(tabParam)
    ) {
      setActiveTabState(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<AdminTab>;
      if (customEvent.detail) {
        setActiveTabState(customEvent.detail);
      }
    };
    window.addEventListener("admin-tab-change", handler);
    return () => window.removeEventListener("admin-tab-change", handler);
  }, []);

  const [events, setEvents] = useState<DbEvent[]>([]);
  const [portalConfig, setPortalConfig] = useState<DbPortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Modal / Form state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DbEvent | null>(null);
  const [isTBA, setIsTBA] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    eventDate: "",
    eventTiming: "",
    speakerName: "",
    attendanceOpen: true,
    setAsActive: false,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Lock body scroll and background mouse wheel when modal is open
  useEffect(() => {
    if (showForm) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showForm]);

  // Section B — Participant inspection state
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [inspectingEventId, setInspectingEventId] = useState<string | null>(null);

  // Auto-select active event if none selected
  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      const defaultId = portalConfig?.active_event_id || events[0].id;
      setSelectedEventId(defaultId);
      setInspectingEventId(defaultId);
    }
  }, [selectedEventId, events, portalConfig]);
  const attendeesSectionRef = useRef<HTMLElement | null>(null);
  const [participants, setParticipants] = useState<AdminParticipantRow[]>([]);
  const [totalAttended, setTotalAttended] = useState<number>(0);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingParticipantKey, setDeletingParticipantKey] = useState<string | null>(null);

  // Section C — Team Members state
  const [teamMembers, setTeamMembers] = useState<DbTeamMember[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState<DbTeamMember | null>(null);
  const [selectedTeamBatch, setSelectedTeamBatch] = useState<string>("2026-27");
  const [customBatches, setCustomBatches] = useState<string[]>([]);
  const [teamFormData, setTeamFormData] = useState({
    name: "",
    picUrl: "",
    course: "",
    branch: "",
    year: "",
    role: "",
    batch: "2026-27",
    displayOrder: 0,
  });
  const [teamFormSubmitting, setTeamFormSubmitting] = useState(false);
  const [teamFormError, setTeamFormError] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [deletingTeamMemberId, setDeletingTeamMemberId] = useState<string | null>(null);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picUploadError, setPicUploadError] = useState("");
  const [picDragActive, setPicDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Bulk Import State ──────────────────────────────────────
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportBatch, setBulkImportBatch] = useState("2026-27");
  const [bulkImportRows, setBulkImportRows] = useState<any[]>([]);
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
  const [bulkImportFileName, setBulkImportFileName] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkDragActive, setBulkDragActive] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkImportMode, setBulkImportMode] = useState<"append" | "overwrite">("append");

  // ── Custom Confirmation Modal State ───────────────────────
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "create" | "danger" | "info";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = useCallback((opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "create" | "danger" | "info";
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmModal({
      isOpen: true,
      ...opts,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Escape key listener for confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && confirmModal.isOpen) {
        closeConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal.isOpen, closeConfirm]);

  // ── Data Fetching ─────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [eventsRes, configRes] = await Promise.all([
        fetch("/api/admin/events", { cache: "no-store" }),
        fetch("/api/admin/portal-config", { cache: "no-store" }),
      ]);

      const eventsData = await eventsRes.json();
      const configData = await configRes.json();

      if (eventsData.success) {
        const loadedEvents: DbEvent[] = eventsData.data || [];
        setEvents(loadedEvents);
      }
      if (configData.success) setPortalConfig(configData.data || null);

      if (isRefresh) toast.success("Dashboard data refreshed");
    } catch (e: any) {
      setError("Failed to load dashboard data: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch Team Members ─────────────────────────────────────
  const fetchTeamMembers = useCallback(async () => {
    setLoadingTeamMembers(true);
    try {
      const res = await fetch("/api/admin/team-members", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setTeamMembers(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load team members:", err);
    } finally {
      setLoadingTeamMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchTeamMembers();
  }, [fetchData, fetchTeamMembers]);

  // ── Fetch Participants for Selected Event ──────────────────
  const fetchParticipants = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setLoadingParticipants(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/participants`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success && json.data) {
        const cleaned = (json.data.participants || []).map((p: AdminParticipantRow) => ({
          ...p,
          name: formatFullName(p.name),
        }));
        setParticipants(cleaned);
        setTotalAttended(json.data.totalCount || 0);
      } else {
        setParticipants([]);
        setTotalAttended(0);
      }
    } catch (err) {
      console.error("Failed to load participants:", err);
      setParticipants([]);
      setTotalAttended(0);
    } finally {
      setLoadingParticipants(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchParticipants(selectedEventId);
    }
  }, [selectedEventId, fetchParticipants]);

  // ── Auth ──────────────────────────────────────────────────
  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
    router.refresh();
  };

  // ── Form Handlers ─────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      eventDate: "",
      eventTiming: "",
      speakerName: "",
      attendanceOpen: true,
      setAsActive: false,
    });
    setIsTBA(false);
    setEditingEvent(null);
    setFormError("");
    setShowForm(false);
  };

  const handleToggleTBA = (checked: boolean) => {
    setIsTBA(checked);
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        eventTiming: "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        eventDate: prev.eventDate || new Date().toISOString().split("T")[0],
        eventTiming: prev.eventTiming || "11:00 AM - 12:30 PM",
      }));
    }
  };

  const startCreate = () => {
    resetForm();
    setIsTBA(false);
    setFormData((prev) => ({
      ...prev,
      eventDate: new Date().toISOString().split("T")[0],
      eventTiming: "11:00 AM - 12:30 PM",
      setAsActive: events.length === 0,
      attendanceOpen: true,
    }));
    setShowForm(true);
  };

  const startEdit = (event: DbEvent) => {
    setEditingEvent(event);
    const eventIsTBA = !event.event_date || event.event_date.toLowerCase() === "tba" || !event.event_timing;
    setIsTBA(eventIsTBA);
    setFormData({
      name: event.name,
      description: event.description || "",
      eventDate: event.event_date || "",
      eventTiming: event.event_timing || "",
      speakerName: event.speaker_name || "",
      attendanceOpen: event.attendance_open,
      setAsActive: portalConfig?.active_event_id === event.id,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Event Title is required.");
      setFormSubmitting(false);
      return;
    }

    if (!isTBA) {
      if (!formData.eventDate) {
        setFormError("Event Date is required unless marked as To be announced.");
        setFormSubmitting(false);
        return;
      }
      if (!formData.eventTiming.trim()) {
        setFormError("Timing is required unless marked as To be announced.");
        setFormSubmitting(false);
        return;
      }
    }

    try {
      const url = editingEvent
        ? `/api/admin/events/${editingEvent.id}`
        : "/api/admin/events";
      const method = editingEvent ? "PUT" : "POST";

      const payload = {
        ...formData,
        isTBA,
        eventDate: isTBA ? null : formData.eventDate,
        eventTiming: isTBA ? null : formData.eventTiming,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setFormError(data.error || "Operation failed.");
        return;
      }

      toast.success(editingEvent ? "Event updated successfully" : "Event created successfully");
      resetForm();
      await fetchData();
    } catch (e: any) {
      setFormError("Request failed: " + (e.message || "Unknown error"));
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Toggle Attendance Master Switch ───────────────────────
  const toggleAttendance = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/admin/portal-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceEnabled: enabled }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(enabled ? "Attendance collection enabled" : "Attendance collection disabled");
        await fetchData();
      } else {
        toast.error(json.error || "Failed to toggle attendance");
      }
    } catch (e: any) {
      setError("Failed to toggle attendance: " + e.message);
    }
  };

  // ── Set Active Event ──────────────────────────────────────
  const handleSetActiveEvent = async (event: DbEvent) => {
    try {
      const res = await fetch("/api/admin/portal-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeEventId: event.id,
          attendanceEnabled: event.attendance_open,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`"${event.name}" is now the active portal event`);
        await fetchData();
      } else {
        toast.error(json.error || "Failed to set active event");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update configuration");
    }
  };

  // ── Inspect Attendees Handler ─────────────────────────────
  const handleInspectAttendees = (eventId: string) => {
    if (inspectingEventId === eventId && activeTab === "registrations") {
      setInspectingEventId(null);
      setSelectedEventId("");
      return;
    }
    setInspectingEventId(eventId);
    setSelectedEventId(eventId);
    setActiveTab("registrations");
    setTimeout(() => {
      attendeesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  // ── Delete Event ──────────────────────────────────────────
  const handleDeleteEvent = (event: DbEvent) => {
    showConfirm({
      title: "Delete Event",
      message: `Are you sure you want to permanently delete "${event.name}"?\n\nWarning: This action will permanently remove the event, its attendance records, and any issued certificates.`,
      confirmLabel: "Delete Event",
      variant: "danger",
      onConfirm: async () => {
        toast.loading(`Deleting "${event.name}"…`, { id: "delete-event" });

        try {
          const res = await fetch(`/api/admin/events/${event.id}`, {
            method: "DELETE",
          });
          const json = await res.json();

          if (json.success) {
            toast.success(`Event "${event.name}" has been deleted.`, { id: "delete-event" });
            if (inspectingEventId === event.id) {
              setInspectingEventId(null);
              setSelectedEventId("");
            }
            if (editingEvent?.id === event.id) {
              resetForm();
            }
            await fetchData();
          } else {
            toast.error(json.error || "Failed to delete event", { id: "delete-event" });
          }
        } catch (err: any) {
          toast.error(err.message || "Failed to delete event", { id: "delete-event" });
        }
      },
    });
  };

  // ── Remove Participant ──────────────────────────────────────
  const handleRemoveParticipant = (p: AdminParticipantRow) => {
    if (!selectedEventId) return;

    showConfirm({
      title: "Remove Participant",
      message: `Are you sure you want to remove participant "${p.name}" (${p.email})?\n\nWarning: This will permanently delete their attendance record and any associated certificate for this event.`,
      confirmLabel: "Remove Participant",
      variant: "danger",
      onConfirm: async () => {
        const key = p.attendanceId || p.email;
        setDeletingParticipantKey(key);
        toast.loading(`Removing ${p.name}…`, { id: "remove-participant" });

        try {
          const res = await fetch(`/api/admin/events/${selectedEventId}/participants`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attendanceId: p.attendanceId,
              participantId: p.participantId,
              certificateId: p.certificateId,
            }),
          });

          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || "Failed to remove participant");
          }

          toast.success(`Removed "${p.name}" from event.`, { id: "remove-participant" });
          await fetchParticipants(selectedEventId);
          await fetchData();
        } catch (err: any) {
          toast.error(err.message || "Failed to remove participant", { id: "remove-participant" });
        } finally {
          setDeletingParticipantKey(null);
        }
      },
    });
  };

  // ── Copy to Clipboard Helper ──────────────────────────────
  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success(`${label} copied to clipboard`);
  };

  // ── Team Member Form Handlers ─────────────────────────────
  const resetTeamForm = () => {
    setTeamFormData({
      name: "",
      picUrl: "",
      course: "",
      branch: "",
      year: "",
      role: "",
      batch: selectedTeamBatch || "2026-27",
      displayOrder: 0,
    });
    setEditingTeamMember(null);
    setTeamFormError("");
    setPicUploadError("");
    setUploadingPic(false);
    setImageInputMode("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowTeamForm(false);
  };

  const startCreateTeamMember = (batchToUse?: string) => {
    resetTeamForm();
    const targetBatch = batchToUse || selectedTeamBatch || "2026-27";
    setTeamFormData((prev) => ({
      ...prev,
      batch: targetBatch,
      displayOrder: teamMembers.filter((m) => (m.batch || "2026-27") === targetBatch).length,
    }));
    setShowTeamForm(true);
  };

  const startEditTeamMember = (member: DbTeamMember) => {
    setEditingTeamMember(member);
    setTeamFormData({
      name: member.name,
      picUrl: member.pic_url || "",
      course: member.course,
      branch: member.branch,
      year: member.year,
      role: member.role,
      batch: member.batch || "2026-27",
      displayOrder: member.display_order,
    });
    setTeamFormError("");
    setPicUploadError("");
    setUploadingPic(false);
    setImageInputMode("upload");
    setShowTeamForm(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPicUploadError("Please select a valid image file (PNG, JPG, WebP, etc.).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPicUploadError("Image size must be less than 5MB.");
      return;
    }

    setUploadingPic(true);
    setPicUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/team-members/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        setPicUploadError(data.error || "Failed to upload image.");
        toast.error(data.error || "Failed to upload image");
        return;
      }

      setTeamFormData((prev) => ({
        ...prev,
        picUrl: data.url,
      }));
      toast.success("Profile image uploaded successfully");
    } catch (err: any) {
      setPicUploadError(err.message || "Failed to upload image.");
      toast.error("Failed to upload image");
    } finally {
      setUploadingPic(false);
    }
  };

  const handlePicDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPicDragActive(true);
  };

  const handlePicDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPicDragActive(false);
  };

  const handlePicDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPicDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleTeamFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamFormSubmitting(true);
    setTeamFormError("");

    if (!teamFormData.name.trim()) { setTeamFormError("Name is required."); setTeamFormSubmitting(false); return; }
    if (!teamFormData.course.trim()) { setTeamFormError("Course is required."); setTeamFormSubmitting(false); return; }
    if (!teamFormData.branch.trim()) { setTeamFormError("Branch is required."); setTeamFormSubmitting(false); return; }
    if (!teamFormData.year.trim()) { setTeamFormError("Year is required."); setTeamFormSubmitting(false); return; }
    if (!teamFormData.role.trim()) { setTeamFormError("Role is required."); setTeamFormSubmitting(false); return; }
    const targetBatch = (teamFormData.batch || selectedTeamBatch || "2026-27").trim();

    try {
      const url = editingTeamMember
        ? `/api/admin/team-members/${editingTeamMember.id}`
        : "/api/admin/team-members";
      const method = editingTeamMember ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...teamFormData, batch: targetBatch }),
      });

      const data = await res.json();

      if (!data.success) {
        setTeamFormError(data.error || "Operation failed.");
        return;
      }

      toast.success(editingTeamMember ? "Team member updated" : "Team member added");
      resetTeamForm();
      await fetchTeamMembers();
    } catch (e: any) {
      setTeamFormError("Request failed: " + (e.message || "Unknown error"));
    } finally {
      setTeamFormSubmitting(false);
    }
  };

  const handleDeleteTeamMember = (member: DbTeamMember) => {
    showConfirm({
      title: "Remove Team Member",
      message: `Are you sure you want to remove "${member.name}" from Batch ${member.batch || "2026-27"}?\n\nThis will permanently delete their profile from the team .`,
      confirmLabel: "Remove Member",
      variant: "danger",
      onConfirm: async () => {
        setDeletingTeamMemberId(member.id);
        toast.loading(`Removing "${member.name}"…`, { id: "delete-team-member" });

        try {
          const res = await fetch(`/api/admin/team-members/${member.id}`, {
            method: "DELETE",
          });
          const json = await res.json();

          if (json.success) {
            toast.success(`"${member.name}" has been removed from the team.`, { id: "delete-team-member" });
            if (editingTeamMember?.id === member.id) resetTeamForm();
            await fetchTeamMembers();
          } else {
            toast.error(json.error || "Failed to remove team member", { id: "delete-team-member" });
          }
        } catch (err: any) {
          toast.error(err.message || "Failed to remove team member", { id: "delete-team-member" });
        } finally {
          setDeletingTeamMemberId(null);
        }
      },
    });
  };

  // Lock body scroll when team form modal is open
  useEffect(() => {
    if (showTeamForm) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showTeamForm]);

  // Lock body scroll when bulk import modal is open
  useEffect(() => {
    if (showBulkImport) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showBulkImport]);

  // ── Parse Excel/CSV file on client ────────────────────────
  const parseImportFile = (file: File) => {
    setBulkImportRows([]);
    setBulkImportErrors([]);
    setBulkImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (json.length === 0) {
          setBulkImportErrors(["The file appears to be empty or has no data rows."]);
          return;
        }

        // Normalize column names (case-insensitive, trim)
        const normalized = json.map((row, i) => {
          const lower: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            lower[k.toLowerCase().trim().replace(/\s+/g, "_")] = row[k];
          });
          return {
            _rowIndex: i + 2,
            name: (lower["name"] ?? lower["full_name"] ?? "").toString().trim(),
            course: (lower["course"] ?? lower["program"] ?? "").toString().trim(),
            branch: (lower["branch"] ?? lower["department"] ?? lower["dept"] ?? "").toString().trim(),
            year: (lower["year"] ?? lower["academic_year"] ?? "").toString().trim(),
            role: (lower["role"] ?? lower["position"] ?? lower["designation"] ?? "").toString().trim(),
            pic_url: (lower["pic_url"] ?? lower["pic"] ?? lower["photo"] ?? lower["image"] ?? lower["image_url"] ?? "").toString().trim() || null,
            batch: (lower["batch"] ?? lower["cohort"] ?? "").toString().trim() || selectedTeamBatch || "2026-27",
            display_order: Number(lower["display_order"] ?? lower["order"] ?? i) || i,
          };
        });

        // Client-side validation preview
        const errors: string[] = [];
        normalized.forEach((m) => {
          if (!m.name) errors.push(`Row ${m._rowIndex}: Name is missing`);
          if (!m.course) errors.push(`Row ${m._rowIndex}: Course is missing`);
          if (!m.branch) errors.push(`Row ${m._rowIndex}: Branch is missing`);
          if (!m.year) errors.push(`Row ${m._rowIndex}: Year is missing`);
          if (!m.role) errors.push(`Row ${m._rowIndex}: Role is missing`);
        });

        setBulkImportErrors(errors);
        setBulkImportRows(normalized);
      } catch (err: any) {
        setBulkImportErrors(["Failed to parse file: " + (err.message || "Unknown error")]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkFileSelect = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv", "ods"].includes(ext || "")) {
      setBulkImportErrors(["Unsupported file type. Please upload .xlsx, .xls, .csv, or .ods"]);
      return;
    }
    parseImportFile(file);
  };

  const handleBulkImportSubmit = async () => {
    if (bulkImportRows.length === 0) return;
    if (bulkImportErrors.length > 0) {
      toast.error("Please fix validation errors before importing.");
      return;
    }

    const targetBatch = bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27");
    const existingCount = teamMembers.filter((m) => (m.batch || "2026-27") === targetBatch).length;

    const executeImport = async () => {
      setBulkImporting(true);
      toast.loading(
        bulkImportMode === "overwrite"
          ? `Overwriting & importing ${bulkImportRows.length} members…`
          : `Importing ${bulkImportRows.length} members…`,
        { id: "bulk-import" }
      );

      try {
        // Strip internal _rowIndex before sending
        const members = bulkImportRows.map(({ _rowIndex, ...rest }) => ({
          ...rest,
          batch: rest.batch || targetBatch,
        }));

        const res = await fetch("/api/admin/team-members/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            members,
            batch: targetBatch,
            mode: bulkImportMode,
            overwriteScope: "batch",
          }),
        });

        const data = await res.json();

        if (!data.success) {
          const serverErrors = Array.isArray(data.data) ? data.data : [data.error];
          setBulkImportErrors(serverErrors);
          toast.error(data.error || "Import failed.", { id: "bulk-import" });
          return;
        }

        toast.success(
          bulkImportMode === "overwrite"
            ? `✓ Overwritten and imported ${data.data?.length ?? bulkImportRows.length} members into Batch ${targetBatch}!`
            : `✓ Added ${data.data?.length ?? bulkImportRows.length} team members successfully!`,
          { id: "bulk-import", duration: 5000 }
        );
        setShowBulkImport(false);
        setBulkImportRows([]);
        setBulkImportErrors([]);
        setBulkImportFileName("");
        setBulkImportMode("append");
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
        await fetchTeamMembers();
      } catch (err: any) {
        toast.error(err.message || "Import request failed.", { id: "bulk-import" });
      } finally {
        setBulkImporting(false);
      }
    };

    if (bulkImportMode === "overwrite") {
      showConfirm({
        title: `Overwrite Batch ${targetBatch} Data?`,
        message: `Are you sure you want to overwrite all members in Batch "${targetBatch}"?\n\nThis will permanently delete ${existingCount} existing member(s) and replace them with ${bulkImportRows.length} member(s) from "${bulkImportFileName || "uploaded file"}".\n\nThis action cannot be undone.`,
        confirmLabel: "Yes, Overwrite & Import",
        cancelLabel: "Cancel",
        variant: "danger",
        onConfirm: async () => {
          await executeImport();
        },
      });
      return;
    }

    await executeImport();
  };

  // Unique available batches from team members and custom created batches
  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    set.add("2026-27");
    if (selectedTeamBatch?.trim()) set.add(selectedTeamBatch.trim());
    customBatches.forEach((b) => set.add(b));
    teamMembers.forEach((m) => {
      if (m.batch?.trim()) set.add(m.batch.trim());
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [teamMembers, selectedTeamBatch, customBatches]);

  // Helper to calculate next batch automatically (e.g. 2026-27 -> 2027-28)
  const getNextBatchName = useCallback(() => {
    let maxStartYear = 2026;

    const allBatches = new Set<string>(["2026-27", ...customBatches]);
    if (selectedTeamBatch) allBatches.add(selectedTeamBatch);
    teamMembers.forEach((m) => {
      if (m.batch?.trim()) allBatches.add(m.batch.trim());
    });

    allBatches.forEach((b) => {
      const match = b.match(/^(\d{4})-(\d{2,4})$/);
      if (match) {
        const yr = parseInt(match[1], 10);
        if (yr > maxStartYear) {
          maxStartYear = yr;
        }
      }
    });

    const nextStart = maxStartYear + 1;
    const nextEnd = (nextStart + 1) % 100;
    return `${nextStart}-${nextEnd.toString().padStart(2, "0")}`;
  }, [customBatches, selectedTeamBatch, teamMembers]);

  const handleCreateNewBatch = () => {
    const nextBatch = getNextBatchName();
    showConfirm({
      title: "Initialize New Batch",
      message: `Create new cohort "${nextBatch}" and switch active view to it?`,
      confirmLabel: `Create Batch ${nextBatch}`,
      variant: "create",
      onConfirm: () => {
        setCustomBatches((prev) => Array.from(new Set([...prev, nextBatch])));
        setSelectedTeamBatch(nextBatch);
        toast.success(`Batch ${nextBatch} created and selected.`);
      },
    });
  };

  // Grouped members for the currently selected batch with search filtering
  const groupedTeamMembers = useMemo(() => {
    const activeBatch = selectedTeamBatch || "2026-27";
    const q = teamSearch.toLowerCase().trim();

    const members = teamMembers.filter((m) => {
      const matchBatch = (m.batch || "2026-27") === activeBatch;
      if (!matchBatch) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.course.toLowerCase().includes(q) ||
        m.branch.toLowerCase().includes(q) ||
        m.year.toLowerCase().includes(q) ||
        (m.batch || "").toLowerCase().includes(q)
      );
    });

    return [{ batch: activeBatch, members }];
  }, [teamMembers, selectedTeamBatch, teamSearch]);

  // ── Export Participants to CSV ────────────────────────────
  const handleExportCSV = async () => {
    if (participants.length === 0) {
      toast.error("No attendee records available to export");
      return;
    }

    const currentEvent = events.find((e) => e.id === selectedEventId);
    const eventTitle = currentEvent?.name || "AWS_SBG_Event";

    const csvData = participants.map((p) => ({
      "Full Name": p.name,
      "Email Address": p.email,
      "Course / Branch": p.course,
      "Roll Number": p.rollNo,
      "Submitted At": p.submittedAt,
      "Certificate ID": p.certificateId || "N/A",
      "Verification Link": p.certificateId
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${p.certificateId}`
        : "N/A",
    }));

    const Papa = (await import("papaparse")).default;
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${eventTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Attendees_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Attendee list exported to CSV");
  };

  // ── Single Certificate Email Send ─────────────────────────
  const handleSendSingleEmail = async (certificateId: string, email: string) => {
    toast.loading(`Dispatching credential to ${email}…`, { id: "email-send" });
    try {
      const res = await fetch("/api/admin/certificates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Certificate emailed to ${email}`, { id: "email-send" });
      } else {
        toast.error(json.error || "Failed to dispatch email", { id: "email-send" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch email", { id: "email-send" });
    }
  };

  // ── Bulk Event Email Dispatch ─────────────────────────────
  const handleBulkSendEmails = async () => {
    if (!selectedEventId || participants.length === 0) {
      toast.error("No attendees with credentials to send");
      return;
    }

    const currentEvent = events.find((e) => e.id === selectedEventId);
    if (
      !confirm(
        `Are you sure you want to email certificates with PDF attachments to all ${totalAttended} attendees of "${currentEvent?.name}"?`
      )
    ) {
      return;
    }

    toast.loading(`Dispatching emails to ${totalAttended} attendees in the background…`, {
      id: "bulk-send",
    });

    try {
      const res = await fetch("/api/admin/certificates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          `Bulk dispatch complete! Sent: ${json.data?.sentCount || 0}, Failed: ${json.data?.failedCount || 0}`,
          { id: "bulk-send", duration: 5000 }
        );
      } else {
        toast.error(json.error || "Bulk email dispatch failed", { id: "bulk-send" });
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk email dispatch failed", { id: "bulk-send" });
    }
  };

  const activeEvent = events.find((e) => e.id === portalConfig?.active_event_id);
  const currentViewEvent =
    events.find((e) => e.id === selectedEventId) ||
    (events.length > 0 ? events[0] : undefined);

  // Available course filters
  const courseOptions = useMemo(() => {
    const courses = new Set<string>();
    participants.forEach((p) => {
      if (p.course) courses.add(p.course);
    });
    return ["ALL", ...Array.from(courses)];
  }, [participants]);

  // Filter participants
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch =
        !participantSearch.trim() ||
        p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
        p.email.toLowerCase().includes(participantSearch.toLowerCase()) ||
        p.rollNo.toLowerCase().includes(participantSearch.toLowerCase()) ||
        p.course.toLowerCase().includes(participantSearch.toLowerCase()) ||
        (p.certificateId && p.certificateId.toLowerCase().includes(participantSearch.toLowerCase()));

      const matchesCourse =
        selectedCourseFilter === "ALL" || p.course === selectedCourseFilter;

      return matchesSearch && matchesCourse;
    });
  }, [participants, participantSearch, selectedCourseFilter]);

  // Stats calculation
  const totalVerifiedCerts = useMemo(() => {
    return participants.filter((p) => Boolean(p.certificateId)).length;
  }, [participants]);

  return (
    <div
      className="min-h-screen text-[#F4F4F6] selection:bg-[#6C63FF]/30 pb-24"
      style={{
        background: `
          radial-gradient(1000px 500px at 15% 0%, rgba(108,99,255,0.14), transparent 70%),
          radial-gradient(800px 400px at 85% 10%, rgba(255,153,0,0.06), transparent 70%),
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px) 0 0/48px 48px,
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px) 0 0/48px 48px,
          #08080B
        `,
      }}
    >
      {/* ── Main Operations Container ───────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 space-y-10">
        {/* ── Top Bar: Admin Portal Heading & Sign Out ───────────────────────── */}
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#6C63FF]/20 via-[#6C63FF]/10 to-[#FF9900]/10 border border-white/[0.1] flex items-center justify-center text-[#A78BFA] shadow-[0_0_20px_rgba(108,99,255,0.15)] shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#A78BFA]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-white tracking-tight truncate">
                  Admin Portal
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#6C63FF]/10 text-[#A78BFA] border border-[#6C63FF]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Console
                </span>
              </div>
              <p className="text-xs text-[#71717A] mt-0.5 truncate hidden sm:block">
                AWS Student Builder Group &bull; Operations &amp; Management Cockpit
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl text-xs font-medium text-[#71717A] hover:text-red-400 hover:bg-red-500/10 border border-white/[0.08] hover:border-red-500/20 transition-all flex items-center gap-2 cursor-pointer bg-white/[0.02] shrink-0"
            title="Sign Out of Admin Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs sm:text-sm text-red-400 flex items-center gap-3">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-[#6C63FF]/30 border-t-[#6C63FF] animate-spin" />
            <p className="text-xs font-mono text-[#71717A] tracking-wider uppercase">
              Loading Operations Cockpit…
            </p>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════ */}
            {/* ── OVERVIEW: EXECUTIVE SUMMARY OF ALL TABS ─────── */}
            {/* ══════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <section className="space-y-6">
                {/* Executive KPI Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* KPI 1: Events */}
                  <div className="p-1 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.08] shadow-lg group hover:border-[#6C63FF]/30 transition-all">
                    <div className="p-5 rounded-[calc(1.5rem-4px)] bg-[#0D0D12] flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[#71717A]">
                          Events Catalog
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center text-[#A78BFA]">
                          <Calendar className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                          {events.length}
                        </p>
                        <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">
                          {activeEvent ? `Active: ${activeEvent.name}` : "No active session"}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("events")}
                        className="text-[11px] font-medium text-[#A78BFA] hover:text-white flex items-center gap-1 transition-colors cursor-pointer pt-1"
                      >
                        <span>Manage events</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* KPI 2: Registrations & Attendance */}
                  <div className="p-1 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.08] shadow-lg group hover:border-emerald-500/30 transition-all">
                    <div className="p-5 rounded-[calc(1.5rem-4px)] bg-[#0D0D12] flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[#71717A]">
                          Live Attendance
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Users className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                          {totalAttended}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              portalConfig?.attendance_enabled && activeEvent?.attendance_open
                                ? "bg-emerald-400 animate-ping"
                                : "bg-amber-400"
                            }`}
                          />
                          <p className="text-xs text-[#A1A1AA] truncate">
                            {portalConfig?.attendance_enabled && activeEvent?.attendance_open
                              ? "Accepting Submissions"
                              : "Submissions Paused"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab("registrations")}
                        className="text-[11px] font-medium text-emerald-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer pt-1"
                      >
                        <span>View directory</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* KPI 3: Team  */}
                  <div className="p-1 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.08] shadow-lg group hover:border-cyan-500/30 transition-all">
                    <div className="p-5 rounded-[calc(1.5rem-4px)] bg-[#0D0D12] flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[#71717A]">
                          Core Team
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                          {teamMembers.length}
                        </p>
                        <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">
                          Batch {selectedTeamBatch || "2026-27"}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("team")}
                        className="text-[11px] font-medium text-cyan-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer pt-1"
                      >
                        <span>Manage team</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* KPI 4: Portal Gateway */}
                  <div className="p-1 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.08] shadow-lg group hover:border-amber-500/30 transition-all">
                    <div className="p-5 rounded-[calc(1.5rem-4px)] bg-[#0D0D12] flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-[#71717A]">
                          Gateway Status
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <SlidersHorizontal className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <p className="text-lg sm:text-xl font-bold font-mono text-white tracking-tight flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              portalConfig?.attendance_enabled ? "bg-emerald-400" : "bg-zinc-500"
                            }`}
                          />
                          {portalConfig?.attendance_enabled ? "LIVE ONLINE" : "DISABLED"}
                        </p>
                        <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">
                          Attendance Gateway
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("settings")}
                        className="text-[11px] font-medium text-amber-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer pt-1"
                      >
                        <span>System settings</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2x2 Bento Summary Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Summary 1: Events Tab Summary */}
                  <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-xl flex flex-col">
                    <div className="p-6 rounded-[calc(2rem-4px)] bg-[#0E0E13] flex flex-col justify-between h-full space-y-5">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center text-[#6C63FF]">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white tracking-tight">Events Summary</h3>
                              <p className="text-xs text-[#71717A]">Active and scheduled sessions</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveTab("events")}
                            className="h-8 px-3 rounded-lg text-xs font-medium text-[#A78BFA] hover:text-white bg-[#6C63FF]/10 hover:bg-[#6C63FF]/20 border border-[#6C63FF]/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Open Tab</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Active Event Highlight Box */}
                        {activeEvent ? (
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Active Session
                              </span>
                              <span className="text-xs font-mono text-[#A1A1AA]">
                                {formatDate(activeEvent.event_date)}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-white truncate">{activeEvent.name}</h4>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-[#71717A]">
                              {activeEvent.speaker_name && <span>Speaker: {activeEvent.speaker_name}</span>}
                              {activeEvent.event_timing && <span>&bull; {activeEvent.event_timing}</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-[#71717A]">
                            No session is currently marked as active
                          </div>
                        )}

                        {/* Recent Events List preview */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] block">
                            Recent Events ({events.length})
                          </span>
                          <div className="space-y-1.5">
                            {events.slice(0, 3).map((ev) => (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.015] border border-white/[0.04] text-xs"
                              >
                                <span className="font-medium text-white truncate max-w-[200px] sm:max-w-xs">
                                  {ev.name}
                                </span>
                                <span className="text-[11px] font-mono text-[#71717A] shrink-0">
                                  {formatDate(ev.event_date)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="text-xs text-[#71717A]">{events.length} total cataloged events</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={startCreate}
                            className="h-8 px-3 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create Event</span>
                          </button>
                          <button
                            onClick={() => setActiveTab("events")}
                            className="h-8 px-3 rounded-lg text-xs font-semibold bg-[#6C63FF] hover:brightness-110 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Go to Events</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary 2: Registrations Tab Summary */}
                  <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-xl flex flex-col">
                    <div className="p-6 rounded-[calc(2rem-4px)] bg-[#0E0E13] flex flex-col justify-between h-full space-y-5">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white tracking-tight">Registrations Summary</h3>
                              <p className="text-xs text-[#71717A]">Attendance records and turnouts</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveTab("registrations")}
                            className="h-8 px-3 rounded-lg text-xs font-medium text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Open Tab</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Turnout stats box */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] block">
                              Active Event Checked In
                            </span>
                            <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                              {totalAttended} Students
                            </p>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] block">
                              Total Records Cached
                            </span>
                            <p className="text-xl font-bold font-mono text-white mt-1">
                              {participants.length} Records
                            </p>
                          </div>
                        </div>

                        {/* Recent Participants preview */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] block">
                            Recent Attendees ({currentViewEvent?.name || "Active Session"})
                          </span>
                          {participants.length > 0 ? (
                            <div className="space-y-1.5">
                              {participants.slice(0, 3).map((p, idx) => (
                                <div
                                  key={p.rollNo || p.attendanceId || idx}
                                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.015] border border-white/[0.04] text-xs"
                                >
                                  <div className="min-w-0">
                                    <span className="font-medium text-white truncate block">{p.name}</span>
                                    <span className="text-[10px] text-[#71717A] truncate block">{p.rollNo} &bull; {p.course || "General"}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                    Verified
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-[#71717A]">
                              No attendee records loaded yet for this session
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="text-xs text-[#71717A]">Export CSV, certificates & logs</span>
                        <button
                          onClick={() => setActiveTab("registrations")}
                          className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:brightness-110 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                        >
                          <span>Open Attendee Directory</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary 3: Team Tab Summary */}
                  <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-xl flex flex-col">
                    <div className="p-6 rounded-[calc(2rem-4px)] bg-[#0E0E13] flex flex-col justify-between h-full space-y-5">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                              <GraduationCap className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white tracking-tight">Team Summary</h3>
                              <p className="text-xs text-[#71717A]">Student Builder Group </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveTab("team")}
                            className="h-8 px-3 rounded-lg text-xs font-medium text-cyan-400 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Open Tab</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Team batch & size pill */}
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] block">
                              Active Batch
                            </span>
                            <p className="text-base font-bold text-white mt-0.5">
                              {selectedTeamBatch || "2026-27"}
                            </p>
                          </div>
                          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {teamMembers.length} Members
                          </span>
                        </div>

                        {/* Team members mini avatar row/grid */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] block">
                            Core Leads &amp; Officers Preview
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {teamMembers.slice(0, 6).map((m) => (
                              <div
                                key={m.id}
                                className="p-2.5 rounded-xl bg-white/[0.015] border border-white/[0.04] flex items-center gap-2.5 min-w-0"
                              >
                                {m.pic_url ? (
                                  <img
                                    src={m.pic_url}
                                    alt={m.name}
                                    className="w-7 h-7 rounded-lg object-cover border border-white/10 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[10px] flex items-center justify-center shrink-0">
                                    {m.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                                  <p className="text-[10px] text-[#71717A] truncate">{m.role || "Builder"}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="text-xs text-[#71717A]">{teamMembers.length} active members</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setActiveTab("team");
                              startCreateTeamMember();
                            }}
                            className="h-8 px-3 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Member</span>
                          </button>
                          <button
                            onClick={() => setActiveTab("team")}
                            className="h-8 px-3 rounded-lg text-xs font-semibold bg-cyan-500 hover:brightness-110 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Go to Team</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary 4: Settings Tab Summary */}
                  <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-xl flex flex-col">
                    <div className="p-6 rounded-[calc(2rem-4px)] bg-[#0E0E13] flex flex-col justify-between h-full space-y-5">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                              <SlidersHorizontal className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white tracking-tight">Settings Summary</h3>
                              <p className="text-xs text-[#71717A]">Portal gateway &amp; hardware controls</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveTab("settings")}
                            className="h-8 px-3 rounded-lg text-xs font-medium text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Open Tab</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Gateway status preview */}
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">Attendance Gateway</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                portalConfig?.attendance_enabled
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                              }`}
                            >
                              {portalConfig?.attendance_enabled ? "Accepting Submissions" : "Disabled"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#71717A]">
                            <span>Bound Active Event:</span>
                            <span className="font-mono text-white truncate max-w-[180px]">
                              {activeEvent?.name || "None Selected"}
                            </span>
                          </div>
                        </div>

                        {/* Quick links box */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] block">
                            Direct Public Portal Links
                          </span>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
                              <span className="text-[#A1A1AA] truncate">Student Check-in: <code className="text-[#6C63FF]">/attendance</code></span>
                              <button
                                onClick={() => {
                                  if (typeof window !== "undefined") {
                                    navigator.clipboard.writeText(`${window.location.origin}/attendance`);
                                    toast.success("Attendance link copied to clipboard!");
                                  }
                                }}
                                className="text-[11px] font-mono text-[#A78BFA] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
                              <span className="text-[#A1A1AA] truncate">Certificate Verification: <code className="text-[#6C63FF]">/verify</code></span>
                              <Link
                                href="/verify"
                                target="_blank"
                                className="text-[11px] font-mono text-[#71717A] hover:text-white flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Visit</span>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="text-xs text-[#71717A]">Hardware switches &amp; QR links</span>
                        <button
                          onClick={() => setActiveTab("settings")}
                          className="h-8 px-3 rounded-lg text-xs font-semibold bg-amber-500 hover:brightness-110 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                        >
                          <span>Go to Settings</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* ── EXECUTIVE METRIC STRIP ──────────────────────── */}
            {/* ══════════════════════════════════════════════════ */}
            {activeTab === "events" && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Active Event */}
                <div className="p-1 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.08] shadow-lg">
                  <div className="p-5 rounded-[calc(1.5rem-4px)] bg-[#0D0D12] flex items-center gap-4 h-full">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-[#6C63FF] shrink-0">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#71717A] block">
                        Active Portal Event
                      </span>
                      <p className="text-base font-bold text-white truncate mt-0.5">
                        {activeEvent?.name || "None Configured"}
                      </p>
                      <span className="text-xs text-[#A1A1AA] flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            portalConfig?.attendance_enabled && activeEvent?.attendance_open
                              ? "bg-emerald-400 animate-ping"
                              : "bg-amber-400"
                          }`}
                        />
                        {portalConfig?.attendance_enabled && activeEvent?.attendance_open
                          ? "Accepting Submissions"
                          : "Submissions Paused"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Total Events Managed */}
                <div className="p-1 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.08] shadow-lg">
                  <div className="p-5 rounded-[calc(1.5rem-4px)] bg-[#0D0D12] flex items-center gap-4 h-full">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#71717A] block">
                        Events Catalog
                      </span>
                      <p className="text-2xl font-mono font-bold text-white tracking-tight mt-0.5">
                        {events.length}
                      </p>
                      <span className="text-xs text-[#A1A1AA]">
                        Workshops &amp; webinars
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* ── SECTION A: CURRENT ACTIVE EVENT COCKPIT ─────── */}
            {/* ══════════════════════════════════════════════════ */}
            {(activeTab === "settings" || activeTab === "events") && (
              <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 text-[10px] font-mono uppercase tracking-wider text-[#A78BFA] mb-2">
                    <Sparkles className="w-3 h-3 text-[#6C63FF]" />
                    <span>Real-Time Event Control</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Active Session Controls
                  </h2>
                </div>
              </div>

              {activeEvent ? (
                /* Double-Bezel Hardware Card */
                <div className="p-1 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
                  <div className="p-6 sm:p-8 rounded-[calc(2rem-4px)] bg-[#0E0E13] space-y-6">
                    {/* Header Row */}
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div className="space-y-3 max-w-2xl">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                            Live Active Portal Event
                          </span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                          {activeEvent.name}
                        </h3>

                        {activeEvent.description && (
                          <p className="text-sm text-[#A1A1AA] leading-relaxed">
                            {activeEvent.description}
                          </p>
                        )}

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap gap-2.5 pt-2">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#D4D4D8]">
                            <Calendar className="w-3.5 h-3.5 text-[#6C63FF]" />
                            <span>{formatDate(activeEvent.event_date)}</span>
                          </div>

                          {activeEvent.event_timing ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#D4D4D8]">
                              <Clock className="w-3.5 h-3.5 text-[#FF9900]" />
                              <span>{activeEvent.event_timing}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#71717A]">
                              <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                              <span>Timing TBA</span>
                            </div>
                          )}

                          {activeEvent.speaker_name && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#D4D4D8]">
                              <User className="w-3.5 h-3.5 text-[#34D399]" />
                              <span>{activeEvent.speaker_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Action Stack */}
                      <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2.5 shrink-0">

                        <button
                          onClick={() => startEdit(activeEvent)}
                          className="h-10 px-4 rounded-xl text-xs font-medium whitespace-nowrap text-white bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#A78BFA]" />
                          <span>Edit Details</span>
                        </button>

                        <Link
                          href="/attendance"
                          target="_blank"
                          className="h-10 px-4 rounded-xl text-xs font-medium whitespace-nowrap text-[#A1A1AA] hover:text-white bg-transparent hover:bg-white/[0.04] border border-white/[0.06] transition-all flex items-center gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Preview Portal</span>
                        </Link>
                      </div>
                    </div>

                    {/* Master Switch Bar (Nested Island) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#14141A] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            portalConfig?.attendance_enabled
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-zinc-800/50 border-zinc-700 text-zinc-400"
                          }`}
                        >
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              Live Attendance Collection
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                                portalConfig?.attendance_enabled
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              }`}
                            >
                              {portalConfig?.attendance_enabled ? "OPEN & ACCEPTING" : "CLOSED / PAUSED"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Machined Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => toggleAttendance(!portalConfig?.attendance_enabled)}
                        className={`
                          relative w-14 h-8 rounded-full transition-all duration-300 cursor-pointer shrink-0 p-1
                          ${portalConfig?.attendance_enabled ? "bg-emerald-500 shadow-lg shadow-emerald-500/25" : "bg-[#27272A]"}
                        `}
                      >
                        <span
                          className={`
                            block w-6 h-6 rounded-full bg-white transition-transform duration-300 shadow-md
                            ${portalConfig?.attendance_enabled ? "translate-x-6" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty Active Event State */
                <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-dashed border-white/10 p-12 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#71717A]">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    No active portal event configured
                  </h3>
                  <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-5">
                    Select an event from the catalog below or create a new session to activate the Attendance Portal.
                  </p>
                  <button
                    onClick={startCreate}
                    className="h-10 px-5 rounded-xl text-xs font-semibold bg-[#6C63FF] hover:brightness-110 text-white transition-all cursor-pointer shadow-lg shadow-[#6C63FF]/20"
                  >
                    Create Your First Event
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* ── ALL EVENTS DECK / BENTO GRID ─────────────────── */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === "events" && events.length > 0 && (
            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      All Events Catalog
                    </h3>
                    <p className="text-xs text-[#71717A]">
                      Select an event to inspect attendee records or switch the active session
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-[#A78BFA] px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      {events.length} Total Sessions
                    </span>
                    <button
                      onClick={startCreate}
                      className="h-10 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:brightness-110 text-white transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-[#6C63FF]/20 active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New Event</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {events.map((event) => {
                    const isActive = event.id === portalConfig?.active_event_id;
                    const isViewing = event.id === selectedEventId;

                    return (
                      <div
                        key={event.id}
                        className={`
                          group relative p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between
                          ${
                            isActive
                              ? "bg-[#6C63FF]/[0.06] border-[#6C63FF]/30 shadow-lg shadow-[#6C63FF]/5"
                              : isViewing
                              ? "bg-white/[0.05] border-white/20"
                              : "bg-[#0E0E13] border-white/[0.06] hover:border-white/15"
                          }
                        `}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-white/5 text-[#71717A] border border-white/5">
                                  Session
                                </span>
                              )}

                              {isViewing && (
                                <span className="text-[10px] font-mono text-[#A78BFA] bg-[#6C63FF]/10 px-2 py-0.5 rounded whitespace-nowrap">
                                  Viewing
                                </span>
                              )}
                            </div>

                            {/* Card Utility Actions (Edit & Delete) */}
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(event);
                                }}
                                title="Edit Event Details"
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEvent(event);
                                }}
                                title="Delete Event"
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-white group-hover:text-[#A78BFA] transition-colors line-clamp-1">
                              {event.name}
                            </h4>
                            {event.description && (
                              <p className="text-xs text-[#71717A] line-clamp-2 mt-1 leading-relaxed">
                                {event.description}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1.5 text-xs text-[#A1A1AA] pt-2 border-t border-white/[0.04]">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                              <span className="truncate">{formatDate(event.event_date)}</span>
                            </div>
                            {event.event_timing ? (
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                <span className="truncate">{event.event_timing}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-[#71717A]">
                                <Clock className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                <span className="truncate">Timing to be announced</span>
                              </div>
                            )}
                            {event.speaker_name && (
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                <span className="truncate">{event.speaker_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="pt-4 mt-4 border-t border-white/[0.04]">
                          {!isActive ? (
                            <div className="flex items-center gap-2">
                              {/* Set Active Button */}
                              <button
                                onClick={() => handleSetActiveEvent(event)}
                                className="flex-1 h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap text-center flex items-center justify-center text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white bg-[#6C63FF]/10 border border-[#6C63FF]/25 hover:border-[#6C63FF] transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                              >
                                Set Active
                              </button>

                              {/* View Attendees Trigger */}
                              <button
                                onClick={() => handleInspectAttendees(event.id)}
                                className={`flex-1 h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
                                  inspectingEventId === event.id
                                    ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/25"
                                    : "text-[#D4D4D8] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]"
                                }`}
                              >
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <span>{inspectingEventId === event.id ? "Hide Attendees" : "Inspect Attendees"}</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleInspectAttendees(event.id)}
                              className={`w-full h-9 px-4 rounded-xl text-xs font-semibold whitespace-nowrap text-center flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
                                inspectingEventId === event.id
                                  ? "bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/25"
                                  : "text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1]"
                              }`}
                            >
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              <span>{inspectingEventId === event.id ? "Hide Attendees" : "Inspect Attendees"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* ── SECTION B: PARTICIPANT DIRECTORY & CREDENTIALS ─ */}
            {/* ══════════════════════════════════════════════════ */}
            {activeTab === "registrations" && (
              currentViewEvent ? (
                <section
                  ref={attendeesSectionRef}
                  className="space-y-5 pt-8 border-t border-white/[0.08] scroll-mt-24"
                >
                {/* Header with Title & Event Context Selector */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-wider text-emerald-400 mb-2">
                      <Users className="w-3 h-3 text-emerald-400" />
                      <span>Attendance Records &amp; Directory</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                        Attendee Directory
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#6C63FF]/20 border border-[#6C63FF]/40 text-[#A78BFA]">
                        {currentViewEvent.name}
                      </span>
                    </div>
                    <p className="text-xs text-[#71717A] mt-1">
                      Official student attendance submissions, registration records, and credential management for this session.
                    </p>
                  </div>

                  {/* Event Selector & Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Event Select Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedEventId}
                        onChange={(e) => {
                          setSelectedEventId(e.target.value);
                          setInspectingEventId(e.target.value);
                        }}
                        className="h-10 pl-3.5 pr-8 rounded-xl text-xs bg-[#111117] border border-white/[0.1] text-white focus:outline-none focus:border-[#6C63FF] transition-colors cursor-pointer appearance-none"
                      >
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name} ({formatDate(ev.event_date)})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A]">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Export CSV Button */}
                    <button
                      onClick={handleExportCSV}
                      disabled={participants.length === 0}
                      className="h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                      title="Export Attendees to CSV"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span className="hidden sm:inline">Export CSV</span>
                    </button>

                    {/* Bulk Email Certificates Button */}
                    <button
                      onClick={handleBulkSendEmails}
                      disabled={participants.length === 0}
                      className="h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                      title="Email Certificates to all attendees"
                    >
                      <Send className="w-4 h-4 text-[#A78BFA]" />
                      <span className="hidden sm:inline">Email Certificates</span>
                    </button>

                    {/* Close Inspector Button */}
                  </div>
                </div>


              {/* Search & Course Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Search by student name, roll number, email, or certificate ID…"
                    className="w-full h-10 pl-10 pr-9 rounded-xl text-xs bg-[#111117] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#6C63FF] transition-colors"
                  />
                  {participantSearch && (
                    <button
                      onClick={() => setParticipantSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Course Filter Pills */}
                {courseOptions.length > 2 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {courseOptions.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedCourseFilter(c)}
                        className={`h-8 px-3 rounded-lg text-[11px] font-mono uppercase whitespace-nowrap transition-all cursor-pointer ${
                          selectedCourseFilter === c
                            ? "bg-[#6C63FF] text-white font-bold"
                            : "bg-white/[0.03] text-[#71717A] hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── PARTICIPANTS TABLE CONTAINER ────────────── */}
              <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/10 shadow-2xl overflow-hidden">
                <div className="rounded-[calc(2rem-4px)] bg-[#0C0C10] overflow-hidden">
                  {loadingParticipants ? (
                    <div className="py-24 text-center space-y-3">
                      <div className="w-7 h-7 mx-auto rounded-full border-2 border-[#6C63FF]/30 border-t-[#6C63FF] animate-spin" />
                      <p className="text-xs text-[#71717A] font-mono">
                        Querying attendance database…
                      </p>
                    </div>
                  ) : filteredParticipants.length === 0 ? (
                    <div className="py-24 text-center px-4 max-w-md mx-auto space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[#71717A]">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-white">
                        {participantSearch || selectedCourseFilter !== "ALL"
                          ? "No matching attendees found"
                          : "No participants attended yet"}
                      </h4>
                      <p className="text-xs text-[#71717A] leading-relaxed">
                        {participantSearch || selectedCourseFilter !== "ALL"
                          ? "Try clearing your search query or selecting a different course filter."
                          : "When students mark their attendance using the session QR code, their verified records will appear in this directory."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[#71717A] font-mono text-[10.5px] uppercase tracking-wider">
                            <th className="py-3.5 px-5">Participant</th>
                            <th className="py-3.5 px-4">Contact</th>
                            <th className="py-3.5 px-4">Academic Details</th>
                            <th className="py-3.5 px-4">Submitted At</th>
                            <th className="py-3.5 px-4">Certificate ID</th>
                            <th className="py-3.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {filteredParticipants.map((p, idx) => (
                            <tr
                              key={`${p.email}-${idx}`}
                              className="hover:bg-white/[0.025] transition-colors group"
                            >
                              {/* Name with Avatar Initials */}
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6C63FF]/20 to-[#A78BFA]/20 border border-[#6C63FF]/30 flex items-center justify-center text-[10px] font-bold text-[#A78BFA] shrink-0 font-mono">
                                    {getInitials(p.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-white block truncate">
                                      {p.name}
                                    </span>
                                    <span className="text-[10px] text-[#71717A] font-mono">
                                      Roll: {p.rollNo}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Email */}
                              <td className="py-4 px-4 text-[#A1A1AA] font-mono text-[11.5px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate max-w-[190px]">{p.email}</span>
                                  <button
                                    onClick={() => handleCopy(p.email, `email-${idx}`, "Email")}
                                    className="opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-white transition-opacity cursor-pointer"
                                    title="Copy Email"
                                  >
                                    {copiedKey === `email-${idx}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Course */}
                              <td className="py-4 px-4">
                                <span className="inline-block px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[#D4D4D8] font-medium text-[11px]">
                                  {p.course}
                                </span>
                              </td>

                              {/* Submitted At */}
                              <td className="py-4 px-4 text-[#71717A] font-mono text-[11px] whitespace-nowrap">
                                {formatDateTime(p.submittedAt)}
                              </td>

                              {/* Certificate ID */}
                              <td className="py-4 px-4 whitespace-nowrap">
                                {p.certificateId ? (
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      href={`/verify/${p.certificateId}`}
                                      target="_blank"
                                      className="font-mono text-xs font-bold text-[#A78BFA] hover:underline flex items-center gap-1"
                                      title="Open Verification Page"
                                    >
                                      <span>{p.certificateId}</span>
                                      <ExternalLink className="w-3 h-3 text-[#71717A]" />
                                    </Link>
                                    <button
                                      onClick={() =>
                                        handleCopy(p.certificateId!, `cert-${idx}`, "Certificate ID")
                                      }
                                      className="opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-white transition-opacity cursor-pointer"
                                      title="Copy ID"
                                    >
                                      {copiedKey === `cert-${idx}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[#52525B] font-mono text-xs">—</span>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="py-4 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {p.certificateId && (
                                    <>
                                      {/* Download PDF button */}
                                      <a
                                        href={`/api/certificates/${p.certificateId}`}
                                        download={`${p.certificateId}.pdf`}
                                        className="h-7 w-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white border border-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                                        title="Download PDF Certificate"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>

                                      {/* Send email button */}
                                      <button
                                        onClick={() => handleSendSingleEmail(p.certificateId!, p.email)}
                                        className="h-7 w-7 rounded-lg bg-white/[0.03] hover:bg-[#6C63FF]/20 text-[#A1A1AA] hover:text-[#6C63FF] border border-white/[0.06] hover:border-[#6C63FF]/30 flex items-center justify-center transition-colors cursor-pointer"
                                        title="Email Certificate with PDF Attachment"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}

                                  {/* Remove participant button */}
                                  <button
                                    onClick={() => handleRemoveParticipant(p)}
                                    disabled={deletingParticipantKey === (p.attendanceId || p.email)}
                                    className="h-7 w-7 rounded-lg bg-white/[0.03] hover:bg-red-500/20 text-[#71717A] hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                                    title="Remove Participant & Certificate"
                                  >
                                    {deletingParticipantKey === (p.attendanceId || p.email) ? (
                                      <div className="w-3 h-3 rounded-full border border-red-400/30 border-t-red-400 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>
              ) : (
                <div className="p-12 text-center rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#71717A]">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white">No Events Available</h3>
                    <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                      Create an event first in the Events tab to view attendee registrations.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("events")}
                    className="h-9 px-4 rounded-xl text-xs font-semibold bg-[#6C63FF] hover:brightness-110 text-white transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Go to Events Catalog</span>
                  </button>
                </div>
              )
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* ── SECTION C: TEAM MEMBERS MANAGEMENT ────────── */}
            {/* ══════════════════════════════════════════════════ */}
            {activeTab === "team" && (
              <section className="space-y-6 pt-8 border-t border-white/[0.08]">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono uppercase tracking-wider text-cyan-400 mb-2">
                    <Users className="w-3 h-3 text-cyan-400" />
                    <span>Team Management</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Team Members Directory
                  </h2>
                  <p className="text-xs text-[#71717A] mt-1">
                    Manage AWS Student Builder Group members organized by batch & tenure cohorts
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-cyan-400 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    {teamMembers.length} Total Members
                  </span>
                  <button
                    onClick={handleCreateNewBatch}
                    className="h-10 px-3.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                    title="Form a new team for the next cohort"
                  >
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>New Batch</span>
                  </button>

                </div>
              </div>

              {/* Batch Filter Tabs & Search Bar Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 rounded-2xl bg-[#0B0B0F] border border-white/[0.06]">
                {/* Batch Selector Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 max-w-full no-scrollbar">
                  <span className="text-[11px] font-mono uppercase text-[#71717A] px-2 shrink-0">
                    Cohorts:
                  </span>
                  {availableBatches.map((b) => {
                    const count = teamMembers.filter((m) => (m.batch || "2026-27") === b).length;
                    const isSelected = selectedTeamBatch === b;
                    const isCurrent = b === "2026-27";
                    return (
                      <button
                        key={b}
                        onClick={() => setSelectedTeamBatch(b)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/25"
                            : "bg-[#14141C] text-[#A1A1AA] hover:text-white border border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        <span>{b}</span>
                        {isCurrent && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                              isSelected ? "bg-black/20 text-black" : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            Current
                          </span>
                        )}
                        <span className={`text-[10px] ${isSelected ? "text-black/75" : "text-[#71717A]"}`}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[200px] md:w-64 shrink-0">
                  <Search className="w-4 h-4 text-[#52525B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Search by name, role, branch…"
                    className="w-full h-8.5 pl-9 pr-8 rounded-xl text-xs bg-[#14141C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {teamSearch && (
                    <button
                      onClick={() => setTeamSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Team Members List (Grouped by Batch with Visual Separators) */}
              {loadingTeamMembers ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                  <div className="w-7 h-7 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                  <p className="text-xs text-[#71717A] font-mono">Loading team …</p>
                </div>
              ) : groupedTeamMembers.length === 0 ? (
                <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-dashed border-white/10">
                  <div className="p-12 rounded-[calc(2rem-4px)] bg-[#0D0D12] text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#71717A]">
                      <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1">
                      {teamSearch
                        ? "No matching team members found"
                        : selectedTeamBatch !== "ALL"
                        ? `No members added to Batch ${selectedTeamBatch} yet`
                        : "No team members added yet"}
                    </h3>
                    <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-5">
                      {teamSearch
                        ? "Try clearing your search query."
                        : `Start building your ${
                            selectedTeamBatch !== "ALL" ? selectedTeamBatch : "team"
                          }  by adding your first member.`}
                    </p>
                    <button
                      onClick={() =>
                        startCreateTeamMember(
                          selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27"
                        )
                      }
                      className="h-10 px-5 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      Add Member to Batch {selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {groupedTeamMembers.map((group) => {
                    const isCurrent = group.batch === "2026-27";
                    const isUpcoming = group.batch > "2026-27";
                    const isPrevious = group.batch < "2026-27";

                    return (
                      <div key={group.batch} className="space-y-4">
                        {/* ── BATCH SEPARATOR BAR ────────────────────────── */}
                        <div className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-[#12121A] via-[#101017] to-[#0D0D12] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 border ${
                                isCurrent
                                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                                  : isUpcoming
                                  ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                                  : "bg-white/[0.05] border-white/[0.1] text-[#A1A1AA]"
                              }`}
                            >
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-mono">
                                  Batch {group.batch}
                                </h3>
                                {isCurrent && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    Current Active Team
                                  </span>
                                )}
                                {isUpcoming && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Next / Upcoming Batch
                                  </span>
                                )}
                                {isPrevious && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">
                                    Previous Batch Alumni
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#71717A] mt-0.5">
                                {group.members.length} {group.members.length === 1 ? "member" : "members"} registered in {group.batch} tenure
                              </p>
                            </div>
                          </div>

                          {/* Batch Action Buttons: Import Excel & Add Member */}
                          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                            <button
                              onClick={() => {
                                setBulkImportBatch(group.batch);
                                setBulkImportRows([]);
                                setBulkImportErrors([]);
                                setBulkImportFileName("");
                                setBulkImportMode("append");
                                setShowBulkImport(true);
                              }}
                              className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                              title={`Import team members into Batch ${group.batch} from Excel or CSV file`}
                            >
                              <Table2 className="w-3.5 h-3.5" />
                              <span>Import Excel</span>
                            </button>
                            <button
                              onClick={() => startCreateTeamMember(group.batch)}
                              className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-[0.98]"
                              title={`Add a member to Batch ${group.batch}`}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Member</span>
                            </button>
                          </div>
                        </div>

                        {/* Batch Members Grid */}
                        {group.members.length === 0 ? (
                          <div className="p-8 rounded-2xl bg-[#0D0D12] border border-dashed border-white/10 text-center space-y-3">
                            <p className="text-xs text-[#71717A]">
                              No team members added to Batch {group.batch} yet.
                            </p>
                            <div className="flex items-center justify-center gap-2.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setBulkImportBatch(group.batch);
                                  setBulkImportRows([]);
                                  setBulkImportErrors([]);
                                  setBulkImportFileName("");
                                  setBulkImportMode("append");
                                  setShowBulkImport(true);
                                }}
                                className="h-8.5 px-3.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                              >
                                <Table2 className="w-3.5 h-3.5" />
                                <span>Import Excel</span>
                              </button>
                              <button
                                onClick={() => startCreateTeamMember(group.batch)}
                                className="h-8.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-[0.98]"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Add First Member</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                            {group.members.map((member) => (
                              <div
                                key={member.id}
                                className="group relative p-4 rounded-2xl border border-white/[0.06] bg-[#0E0E13] hover:border-cyan-500/25 transition-all duration-300 flex flex-col justify-between hover:shadow-lg hover:shadow-cyan-500/5"
                              >
                                <div>
                                  {/* Top bar: Avatar on left, Quick Actions on right */}
                                  <div className="flex items-center justify-between gap-2.5">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.08] bg-gradient-to-tr from-cyan-500/15 to-blue-500/15 flex items-center justify-center shrink-0">
                                      {member.pic_url ? (
                                        <img
                                          src={member.pic_url}
                                          alt={member.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                          }}
                                        />
                                      ) : null}
                                      <span
                                        className={`text-xs font-bold text-cyan-400 font-mono ${
                                          member.pic_url ? "hidden" : ""
                                        }`}
                                      >
                                        {getInitials(member.name)}
                                      </span>
                                    </div>

                                    {/* Card Actions (Edit & Delete) */}
                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button
                                        onClick={() => startEditTeamMember(member)}
                                        title="Edit Team Member"
                                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTeamMember(member)}
                                        disabled={deletingTeamMemberId === member.id}
                                        title="Remove Team Member"
                                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer disabled:opacity-40"
                                      >
                                        {deletingTeamMemberId === member.id ? (
                                          <div className="w-3 h-3 rounded-full border border-red-400/30 border-t-red-400 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Identity: Full width name & role */}
                                  <div className="mt-3 min-w-0">
                                    <h4 className="text-[14px] font-semibold text-white group-hover:text-cyan-300 transition-colors truncate tracking-tight">
                                      {member.name}
                                    </h4>
                                    <div className="mt-1">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 max-w-full">
                                        <Briefcase className="w-2.5 h-2.5 shrink-0" />
                                        <span className="truncate">{member.role}</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Academic Details */}
                                  <div className="space-y-1 text-xs text-[#A1A1AA] pt-3 mt-3 border-t border-white/[0.04]">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <GraduationCap className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                      <span className="truncate text-[11.5px]">
                                        {member.course} — {member.branch}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                      <span className="truncate text-[11px] text-[#71717A] font-mono">{member.year}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>

      {/* ══════════════════════════════════════════════════ */}
      {/* ── CREATE / EDIT EVENT MODAL (FROSTED GLASS) ───── */}
      {/* ══════════════════════════════════════════════════ */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
            onClick={resetForm}
          />
          <div
            className="relative w-full max-w-xl p-1 rounded-[2rem] bg-white/[0.05] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-4px)] bg-[#0F0F14] overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-6 sm:px-7 py-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {editingEvent ? "Edit Event Session" : "Create New Event Session"}
                  </h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    {editingEvent
                      ? "Update session schedule, timing, and keynote details"
                      : "Define a new workshop or webinar for the AWS Student Builder Group"}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleFormSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div
                  className="p-6 sm:p-7 space-y-5.5 overflow-y-auto overscroll-contain flex-1 min-h-0"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
                  }}
                  data-lenis-prevent
                  onWheel={(e) => e.stopPropagation()}
                >
                  {/* Event Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                      Event Title <span className="text-[#6C63FF]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Cloud Kickstart 2026: AWS Architecture"
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/30 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Description
                      </label>
                      <span className="text-[11px] text-[#71717A]">Optional</span>
                    </div>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief overview of topics covered, cloud services explored, and student takeaways."
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/30 transition-all resize-none leading-relaxed"
                    />
                  </div>

                  {/* Date & Timing Grid */}
                  <div className={cn("grid gap-4", isTBA ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                    {/* Event Date Column */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between min-h-[20px]">
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                          Event Date {!isTBA && <span className="text-[#6C63FF]">*</span>}
                        </label>
                      </div>

                      {isTBA ? (
                        <div
                          onClick={() => handleToggleTBA(false)}
                          className="w-full h-11 px-3.5 rounded-xl bg-[#15151C]/80 border border-dashed border-[#6C63FF]/40 hover:border-[#6C63FF] text-white flex items-center justify-between cursor-pointer transition-all group"
                          title="Click to specify date and timing"
                        >
                          <div className="flex items-center gap-2.5">
                            <Calendar className="w-4 h-4 text-[#A78BFA]" />
                            <span className="text-xs sm:text-sm text-[#E4E4E7] font-medium">
                              Date & Timing to be announced
                            </span>
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#6C63FF]/15 text-[#A78BFA] border border-[#6C63FF]/30 font-semibold group-hover:bg-[#6C63FF]/25 transition-colors">
                            Set Date
                          </span>
                        </div>
                      ) : (
                        <DatePicker
                          value={formData.eventDate}
                          onChange={(date) =>
                            setFormData((prev) => ({ ...prev, eventDate: date }))
                          }
                          onSelectTBA={() => handleToggleTBA(true)}
                          placeholder="Select event date"
                          required
                        />
                      )}
                    </div>

                    {/* Timing Column - Hidden if TBA */}
                    {!isTBA && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between min-h-[20px]">
                          <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                            Timing <span className="text-[#6C63FF]">*</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.eventTiming}
                          onChange={(e) =>
                            setFormData({ ...formData, eventTiming: e.target.value })
                          }
                          placeholder="e.g. 11:00 AM - 12:30 PM"
                          className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/30 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {/* Speaker Name */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Speaker / Lead Presenter
                      </label>
                      <span className="text-[11px] text-[#71717A]">Optional</span>
                    </div>
                    <input
                      type="text"
                      value={formData.speakerName}
                      onChange={(e) =>
                        setFormData({ ...formData, speakerName: e.target.value })
                      }
                      placeholder="e.g. Mr. Aashu Dev"
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/30 transition-all"
                    />
                  </div>

                  {/* Set As Active Toggle */}
                  <div className="pt-1">
                    <label className="p-3.5 sm:p-4 rounded-xl bg-[#15151C] border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-between cursor-pointer transition-colors group">
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-white block group-hover:text-[#A78BFA] transition-colors">
                          Set as Active Portal Event
                        </span>
                        <span className="text-[11px] text-[#71717A] mt-0.5 block leading-normal">
                          Immediately display this event on the student Attendance Portal
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.setAsActive}
                        onChange={(e) =>
                          setFormData({ ...formData, setAsActive: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-[#6C63FF] focus:ring-[#6C63FF] accent-[#6C63FF] cursor-pointer shrink-0"
                      />
                    </label>
                  </div>

                  {formError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      {formError}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-white/[0.06] bg-[#0F0F14] flex items-center justify-between gap-2.5 shrink-0">
                  {editingEvent ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(editingEvent)}
                      className="h-10 px-3.5 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Event</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="h-10 px-4 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="h-10 px-5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] hover:brightness-110 text-white transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-[#6C63FF]/20"
                    >
                      {formSubmitting
                        ? "Saving Session…"
                        : editingEvent
                        ? "Save Changes"
                        : "Create Event"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── ADD / EDIT TEAM MEMBER MODAL ────────────────── */}
      {/* ══════════════════════════════════════════════════ */}
      {showTeamForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
            onClick={resetTeamForm}
          />
          <div
            className="relative w-full max-w-xl p-1 rounded-[2rem] bg-white/[0.05] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-4px)] bg-[#0F0F14] overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-6 sm:px-7 py-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {editingTeamMember ? "Edit Team Member" : "Add Team Member"}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Batch {teamFormData.batch || selectedTeamBatch || "2026-27"}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    {editingTeamMember
                      ? "Update member details, photo, and role"
                      : `Add a member to Batch ${teamFormData.batch || selectedTeamBatch || "2026-27"} cohort`}
                  </p>
                </div>
                <button
                  onClick={resetTeamForm}
                  className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleTeamFormSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div
                  className="p-6 sm:p-7 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
                  }}
                  data-lenis-prevent
                  onWheel={(e) => e.stopPropagation()}
                >
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                      Full Name <span className="text-cyan-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={teamFormData.name}
                      onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                      placeholder="e.g. Piyush Rawat"
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                    />
                  </div>

                  {/* Profile Picture: Direct Upload or URL */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Profile Picture
                      </label>

                      {/* Segmented control for Upload vs URL */}
                      <div className="flex items-center bg-[#15151C] p-0.5 rounded-lg border border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => setImageInputMode("upload")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                            imageInputMode === "upload"
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                              : "text-[#71717A] hover:text-[#A1A1AA]"
                          }`}
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload File</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageInputMode("url")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                            imageInputMode === "url"
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                              : "text-[#71717A] hover:text-[#A1A1AA]"
                          }`}
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Image URL</span>
                        </button>
                      </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageUpload(e.target.files[0]);
                        }
                      }}
                    />

                    {imageInputMode === "upload" ? (
                      <div className="space-y-2">
                        {teamFormData.picUrl ? (
                          /* Current Image Attached Preview */
                          <div className="p-3.5 rounded-2xl bg-[#15151C] border border-cyan-500/30 flex items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-14 h-14 rounded-xl overflow-hidden border border-cyan-500/40 bg-black/40 flex items-center justify-center shrink-0 shadow-md">
                                <img
                                  src={teamFormData.picUrl}
                                  alt="Profile Preview"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Photo Attached</span>
                                </div>
                                <p className="text-[11px] text-[#71717A] truncate max-w-[200px] sm:max-w-[280px] font-mono mt-0.5">
                                  {teamFormData.picUrl}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPic}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {uploadingPic ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                                ) : (
                                  <Camera className="w-3 h-3 text-cyan-400" />
                                )}
                                <span>Change</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTeamFormData({ ...teamFormData, picUrl: "" });
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                className="p-1.5 rounded-lg text-[#71717A] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                title="Remove image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Drag & Drop Upload Zone */
                          <div
                            onClick={() => !uploadingPic && fileInputRef.current?.click()}
                            onDragOver={handlePicDragOver}
                            onDragLeave={handlePicDragLeave}
                            onDrop={handlePicDrop}
                            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group ${
                              picDragActive
                                ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
                                : "border-white/[0.12] bg-[#121218]/50 hover:border-cyan-500/40 hover:bg-[#151520]"
                            }`}
                          >
                            {uploadingPic ? (
                              <div className="py-2 flex flex-col items-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                                <span className="text-xs font-medium text-cyan-300">
                                  Uploading image…
                                </span>
                                <span className="text-[10px] text-[#71717A]">
                                  Please wait a moment
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shadow-sm">
                                  <Upload className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white group-hover:text-cyan-300 transition-colors">
                                    Click to browse or drag & drop profile image
                                  </p>
                                  <p className="text-[11px] text-[#71717A] mt-0.5">
                                    PNG, JPG, WebP, GIF up to 5MB
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {picUploadError && (
                          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                            {picUploadError}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* URL Direct Input Mode */
                      <div className="space-y-1.5">
                        <div className="flex gap-2.5">
                          <input
                            type="text"
                            value={teamFormData.picUrl}
                            onChange={(e) => setTeamFormData({ ...teamFormData, picUrl: e.target.value })}
                            placeholder="e.g. /members/johndoe.png or https://..."
                            className="flex-1 h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono text-xs"
                          />
                          {teamFormData.picUrl && (
                            <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/[0.1] bg-[#15151C] flex items-center justify-center shrink-0">
                              <img
                                src={teamFormData.picUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-[#71717A]">
                          Enter an image URL from the web or a local path in /members/
                        </p>
                      </div>
                    )}
                  </div>


                  {/* Course & Branch Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Course <span className="text-cyan-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.course}
                        onChange={(e) => setTeamFormData({ ...teamFormData, course: e.target.value })}
                        placeholder="e.g. B.Tech, BCA, MCA"
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Branch <span className="text-cyan-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.branch}
                        onChange={(e) => setTeamFormData({ ...teamFormData, branch: e.target.value })}
                        placeholder="e.g. CSE, ECE, IT"
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Year & Role Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Year <span className="text-cyan-500">*</span>
                      </label>
                      <select
                        required
                        value={teamFormData.year}
                        onChange={(e) => setTeamFormData({ ...teamFormData, year: e.target.value })}
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all cursor-pointer appearance-none"
                      >
                        <option value="" disabled>Select year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Role <span className="text-cyan-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.role}
                        onChange={(e) => setTeamFormData({ ...teamFormData, role: e.target.value })}
                        placeholder="e.g. Tech Lead, Cloud Lead, Member"
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Display Order */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Display Order
                      </label>
                      <span className="text-[11px] text-[#71717A]">Lower = shown first</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={teamFormData.displayOrder}
                      onChange={(e) => setTeamFormData({ ...teamFormData, displayOrder: parseInt(e.target.value) || 0 })}
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                    />
                  </div>

                  {teamFormError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      {teamFormError}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-white/[0.06] bg-[#0F0F14] flex items-center justify-between gap-2.5 shrink-0">
                  {editingTeamMember ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteTeamMember(editingTeamMember)}
                      className="h-10 px-3.5 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Member</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={resetTeamForm}
                      className="h-10 px-4 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={teamFormSubmitting}
                      className="h-10 px-5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-white transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-cyan-500/20"
                    >
                      {teamFormSubmitting
                        ? "Saving…"
                        : editingTeamMember
                        ? "Save Changes"
                        : "Add Member"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── BULK IMPORT MODAL ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════ */}
      {showBulkImport && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => {
              if (!bulkImporting) setShowBulkImport(false);
            }}
          />
          <div
            className="relative w-full max-w-4xl p-1 rounded-[2rem] bg-white/[0.05] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-4px)] bg-[#0F0F14] overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 sm:px-8 py-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                    <Table2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Bulk Import Team Members
                    </h3>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      Upload an Excel (.xlsx/.xls), CSV, or ODS file — up to 200 members at once
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { if (!bulkImporting) setShowBulkImport(false); }}
                  className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div
                className="p-6 sm:p-8 space-y-6 overflow-y-auto overscroll-contain flex-1 min-h-0"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
                data-lenis-prevent
                onWheel={(e) => e.stopPropagation()}
              >
                {/* Step 1 — Required columns info */}
                <div className="p-4 rounded-2xl bg-[#12121A] border border-white/[0.06] space-y-3">
                  <p className="text-xs font-mono uppercase tracking-wider text-[#71717A]">
                    Required columns in your spreadsheet
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["name", "course", "branch", "year", "role"].map((col) => (
                      <span
                        key={col}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      >
                        {col}
                      </span>
                    ))}
                    <span className="text-xs text-[#71717A] self-center pl-1">+</span>
                    {["batch", "pic_url", "display_order"].map((col) => (
                      <span
                        key={col}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.04] text-[#A1A1AA] border border-white/[0.08]"
                      >
                        {col} <span className="text-[#52525B]">(optional)</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#52525B]">
                    Column names are flexible — e.g. "Full Name", "Department", "Position", "Photo" are all recognised automatically.
                    Members without a batch column in your spreadsheet will automatically be assigned to Batch {bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27")}.
                  </p>
                </div>

                {/* Target Batch Information */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#14141C] border border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#71717A]">
                      Target Batch:
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      Batch {bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27")}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#71717A] font-mono">
                    ({teamMembers.filter((m) => (m.batch || "2026-27") === (bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27"))).length} current member{teamMembers.filter((m) => (m.batch || "2026-27") === (bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27"))).length !== 1 ? "s" : ""})
                  </span>
                </div>

                {/* Import Strategy: Append vs Overwrite Options */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
                      Import Method
                    </label>
                    <span className="text-[11px] text-[#71717A] font-mono">
                      Choose how to apply spreadsheet rows
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: Add to Existing Data */}
                    <button
                      type="button"
                      onClick={() => setBulkImportMode("append")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        bulkImportMode === "append"
                          ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "bg-[#14141C] border-white/[0.06] hover:border-white/15 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            bulkImportMode === "append" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.05] text-[#71717A]"
                          }`}>
                            <UserPlus className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-white block">Add to Existing</span>
                            <span className="text-[10px] font-mono text-emerald-400">Append data</span>
                          </div>
                        </div>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          bulkImportMode === "append" ? "border-emerald-400 bg-emerald-400" : "border-white/20"
                        }`}>
                          {bulkImportMode === "append" && <span className="w-1.5 h-1.5 rounded-full bg-[#0D0D14]" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                        Keep all current members and append new members from this sheet alongside them.
                      </p>
                    </button>

                    {/* Option 2: Overwrite Current Data */}
                    <button
                      type="button"
                      onClick={() => setBulkImportMode("overwrite")}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        bulkImportMode === "overwrite"
                          ? "bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/30"
                          : "bg-[#14141C] border-white/[0.06] hover:border-white/15 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            bulkImportMode === "overwrite" ? "bg-rose-500/20 text-rose-300" : "bg-white/[0.05] text-[#71717A]"
                          }`}>
                            <RefreshCw className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-white block">Overwrite Current Data</span>
                            <span className="text-[10px] font-mono text-rose-400">Replace cohort</span>
                          </div>
                        </div>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          bulkImportMode === "overwrite" ? "border-rose-400 bg-rose-400" : "border-white/20"
                        }`}>
                          {bulkImportMode === "overwrite" && <span className="w-1.5 h-1.5 rounded-full bg-[#0D0D14]" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                        Clear existing members in this batch and replace them completely with the spreadsheet data.
                      </p>
                    </button>
                  </div>

                  {/* Overwrite Warning Banner */}
                  {bulkImportMode === "overwrite" && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-[11.5px] text-rose-200/90 leading-relaxed flex-1">
                        <span className="font-semibold text-rose-300">Caution:</span> All current members in{" "}
                        <span className="font-mono font-bold text-white bg-rose-500/20 px-1.5 py-0.5 rounded">
                          Batch {bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27")}
                        </span>{" "}
                        ({teamMembers.filter((m) => (m.batch || "2026-27") === (bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27"))).length} member{teamMembers.filter((m) => (m.batch || "2026-27") === (bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27"))).length !== 1 ? "s" : ""}) will be permanently deleted and replaced with this file.
                      </div>
                    </div>
                  )}
                </div>


                {/* Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    bulkDragActive
                      ? "border-emerald-400 bg-emerald-500/10"
                      : bulkImportFileName
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-white/[0.12] hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.04]"
                  } cursor-pointer`}
                  onDragOver={(e) => { e.preventDefault(); setBulkDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setBulkDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setBulkDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleBulkFileSelect(file);
                  }}
                  onClick={() => bulkFileInputRef.current?.click()}
                >
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.ods"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBulkFileSelect(file);
                    }}
                  />
                  {bulkImportFileName ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-white">{bulkImportFileName}</p>
                      <p className="text-xs text-emerald-400">
                        {bulkImportRows.length} rows detected — click to replace file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#71717A]">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Drop your spreadsheet here
                        </p>
                        <p className="text-xs text-[#71717A] mt-1">
                          or click to browse — .xlsx, .xls, .csv, .ods accepted
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Errors */}
                {bulkImportErrors.length > 0 && (
                  <div className="p-4 rounded-2xl bg-red-500/8 border border-red-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p className="text-xs font-semibold">
                        {bulkImportErrors.length} validation {bulkImportErrors.length === 1 ? "issue" : "issues"} found — fix before importing
                      </p>
                    </div>
                    <ul className="space-y-1 max-h-32 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                      {bulkImportErrors.map((err, i) => (
                        <li key={i} className="text-xs text-red-300 font-mono pl-6">
                          • {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview Table */}
                {bulkImportRows.length > 0 && bulkImportErrors.length === 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono uppercase tracking-wider text-[#71717A]">
                        Preview — {bulkImportRows.length} member{bulkImportRows.length !== 1 ? "s" : ""} ready to import
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        All rows valid ✓
                      </span>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-white/[0.07]">
                      <div className="overflow-x-auto max-h-64" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.12) transparent" }}>
                        <table className="w-full text-xs">
                          <thead className="bg-[#0B0B0F] border-b border-white/[0.07]">
                            <tr>
                              {["#", "Name", "Role", "Course", "Branch", "Year", "Batch"].map((h) => (
                                <th key={h} className="text-left px-3 py-2.5 text-[#71717A] font-mono font-semibold uppercase tracking-wider whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {bulkImportRows.slice(0, 50).map((row, i) => (
                              <tr key={i} className="hover:bg-white/[0.025] transition-colors">
                                <td className="px-3 py-2 text-[#52525B] font-mono">{i + 1}</td>
                                <td className="px-3 py-2 text-white font-medium whitespace-nowrap max-w-[160px] truncate">{row.name || <span className="text-red-400">—</span>}</td>
                                <td className="px-3 py-2 text-cyan-400 whitespace-nowrap">{row.role || <span className="text-red-400">—</span>}</td>
                                <td className="px-3 py-2 text-[#A1A1AA] whitespace-nowrap">{row.course || <span className="text-red-400">—</span>}</td>
                                <td className="px-3 py-2 text-[#A1A1AA] whitespace-nowrap">{row.branch || <span className="text-red-400">—</span>}</td>
                                <td className="px-3 py-2 text-[#A1A1AA] whitespace-nowrap">{row.year || <span className="text-red-400">—</span>}</td>
                                <td className="px-3 py-2 text-emerald-400 font-mono whitespace-nowrap">{row.batch}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {bulkImportRows.length > 50 && (
                        <div className="px-4 py-2.5 bg-[#0B0B0F] border-t border-white/[0.06] text-center text-xs text-[#71717A]">
                          Showing first 50 of {bulkImportRows.length} rows
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 sm:px-8 py-4 border-t border-white/[0.06] bg-[#0F0F14] flex items-center justify-between gap-3 shrink-0">
                <a
                  href="/team-import-template.xlsx"
                  download
                  className="h-9 px-3.5 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer"
                  onClick={async (e) => {
                    // Generate a template in-browser instead of fetching a file
                    e.preventDefault();
                    const XLSX = await import("xlsx");
                    const targetBatch = bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27");
                    const ws = XLSX.utils.aoa_to_sheet([
                      ["name", "course", "branch", "year", "role", "batch", "pic_url"],
                      ["Rahul Sharma", "B.Tech", "CSE", "3rd Year", "Tech Lead", targetBatch, ""],
                      ["Priya Singh", "BCA", "IT", "2nd Year", "Cloud Lead", targetBatch, ""],
                    ]);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Team Members");
                    XLSX.writeFile(wb, "team-import-template.xlsx");
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </a>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => { if (!bulkImporting) setShowBulkImport(false); }}
                    className="h-10 px-4 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                    disabled={bulkImporting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImportSubmit}
                    disabled={
                      bulkImporting ||
                      bulkImportRows.length === 0 ||
                      bulkImportErrors.length > 0
                    }
                    className={`h-10 px-5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
                      bulkImportMode === "overwrite"
                        ? "bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 shadow-lg shadow-rose-500/20"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 shadow-lg shadow-emerald-500/20"
                    }`}
                  >
                    {bulkImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{bulkImportMode === "overwrite" ? "Overwriting…" : "Importing…"}</span>
                      </>
                    ) : bulkImportMode === "overwrite" ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>
                          Overwrite & Import {bulkImportRows.length > 0 ? `(${bulkImportRows.length})` : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>
                          Add to Existing {bulkImportRows.length > 0 ? `(${bulkImportRows.length})` : ""}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════ */}
      {/* ── CUSTOM CONFIRMATION DIALOG MODAL ────────────── */}
      {/* ══════════════════════════════════════════════════ */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain animate-in fade-in duration-150"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={closeConfirm}
          />

          {/* Dialog Card */}
          <div
            className="relative w-full max-w-md rounded-3xl bg-[#0F0F16] border border-white/[0.1] shadow-2xl p-6 sm:p-7 overflow-hidden z-10 animate-in zoom-in-95 duration-200"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Top Glow Hairline */}
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
                confirmModal.variant === "danger"
                  ? "via-rose-500/70"
                  : "via-cyan-500/70"
              } to-transparent`}
            />

            {/* Header: Icon badge & Close button */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmModal.variant === "danger"
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/10"
                    : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10"
                }`}
              >
                {confirmModal.variant === "danger" ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : confirmModal.variant === "create" ? (
                  <Plus className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <button
                onClick={closeConfirm}
                className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">
                {confirmModal.message}
              </p>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={closeConfirm}
                className="h-10 px-4 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer"
              >
                {confirmModal.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cb = confirmModal.onConfirm;
                  closeConfirm();
                  await cb();
                }}
                className={`h-10 px-5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer active:scale-[0.98] shadow-lg ${
                  confirmModal.variant === "danger"
                    ? "bg-gradient-to-r from-rose-600 to-red-600 hover:brightness-110 shadow-rose-600/20"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 shadow-cyan-500/20"
                }`}
              >
                {confirmModal.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}
