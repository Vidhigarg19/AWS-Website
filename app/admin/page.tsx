"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import type { DbEvent, DbPortalConfig, AdminParticipantRow, DbTeamMember } from "@/types/certificate";
import { formatFullName, cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Award,
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
  ChevronRight,
  Filter,
  Layers,
  ArrowUpRight,
  CheckCheck,
} from "lucide-react";

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
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ST"
  );
}

function getEventStatus(
  event: DbEvent,
  activeEventId?: string | null
): "active" | "upcoming" | "concluded" | "tba" {
  if (activeEventId && event.id === activeEventId) {
    return "active";
  }
  if (!event.event_date || !event.event_date.trim() || event.event_date.toLowerCase() === "tba") {
    return "tba";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const evDate = new Date(event.event_date + "T00:00:00");
  if (isNaN(evDate.getTime())) return "tba";
  return evDate < today ? "concluded" : "upcoming";
}

// ── Types for Navigation ───────────────────────────────────────
type AdminTab = "events" | "attendees" | "team" | "overview";
type EventFilter = "all" | "active" | "upcoming" | "concluded" | "tba";

// ── Main Admin Page ───────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();

  // Core Data
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [portalConfig, setPortalConfig] = useState<DbPortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Executive Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>("events");
  const [eventsFilter, setEventsFilter] = useState<EventFilter>("all");
  const [eventsSearch, setEventsSearch] = useState("");

  // Event Modal / Form State
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

  // Lock body scroll when modal is open
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

  // Bulk Import State
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportBatch, setBulkImportBatch] = useState("2026-27");
  const [bulkImportRows, setBulkImportRows] = useState<any[]>([]);
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
  const [bulkImportFileName, setBulkImportFileName] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkDragActive, setBulkDragActive] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkImportMode, setBulkImportMode] = useState<"append" | "overwrite">("append");

  // Confirmation Modal State
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

  const showConfirm = useCallback(
    (opts: {
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
    },
    []
  );

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
        // Default selectedEventId to active event or first event if unset
        if (configData.success && configData.data?.active_event_id) {
          setSelectedEventId((prev) => prev || configData.data.active_event_id);
        } else if (loadedEvents.length > 0) {
          setSelectedEventId((prev) => prev || loadedEvents[0].id);
        }
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

  // Fetch Team Members
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

  // Fetch Participants for Selected Event
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
    showConfirm({
      title: "Sign Out",
      message: "Are you sure you want to end your administrative session?",
      confirmLabel: "Sign Out",
      variant: "danger",
      onConfirm: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        toast.success("Signed out successfully");
        router.push("/login");
        router.refresh();
      },
    });
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
    const eventIsTBA =
      !event.event_date || event.event_date.toLowerCase() === "tba" || !event.event_timing;
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
      const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : "/api/admin/events";
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
        toast.success(
          enabled ? "Attendance collection enabled" : "Attendance collection disabled"
        );
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
        toast.success(`"${event.name}" is now the active portal session`);
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
    setSelectedEventId(eventId);
    setInspectingEventId(eventId);
    setActiveTab("attendees");
    setTimeout(() => {
      attendeesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  // ── Delete Event ──────────────────────────────────────────
  const handleDeleteEvent = (event: DbEvent) => {
    showConfirm({
      title: "Delete Event Session",
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
            }
            if (selectedEventId === event.id) {
              setSelectedEventId(events.find((e) => e.id !== event.id)?.id || "");
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
      title: "Remove Participant Record",
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

    if (!teamFormData.name.trim()) {
      setTeamFormError("Name is required.");
      setTeamFormSubmitting(false);
      return;
    }
    if (!teamFormData.course.trim()) {
      setTeamFormError("Course is required.");
      setTeamFormSubmitting(false);
      return;
    }
    if (!teamFormData.branch.trim()) {
      setTeamFormError("Branch is required.");
      setTeamFormSubmitting(false);
      return;
    }
    if (!teamFormData.year.trim()) {
      setTeamFormError("Year is required.");
      setTeamFormSubmitting(false);
      return;
    }
    if (!teamFormData.role.trim()) {
      setTeamFormError("Role is required.");
      setTeamFormSubmitting(false);
      return;
    }
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
      message: `Are you sure you want to remove "${member.name}" from Batch ${member.batch || "2026-27"}?\n\nThis will permanently delete their profile from the team roster.`,
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
            toast.success(`"${member.name}" has been removed from the team.`, {
              id: "delete-team-member",
            });
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
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
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
            pic_url:
              (
                lower["pic_url"] ??
                lower["pic"] ??
                lower["photo"] ??
                lower["image"] ??
                lower["image_url"] ??
                ""
              )
                .toString()
                .trim() || null,
            batch:
              (lower["batch"] ?? lower["cohort"] ?? "").toString().trim() ||
              selectedTeamBatch ||
              "2026-27",
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

    const targetBatch =
      bulkImportBatch || (selectedTeamBatch !== "ALL" ? selectedTeamBatch : "2026-27");
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

  // Available Batches
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
      title: "Initialize New Cohort",
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

  // Grouped members for selected batch
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

  // Export CSV
  const handleExportCSV = () => {
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

  // Single Certificate Email Send
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

  // Bulk Event Email Dispatch
  const handleBulkSendEmails = async () => {
    if (!selectedEventId || participants.length === 0) {
      toast.error("No attendees with credentials to send");
      return;
    }

    const currentEvent = events.find((e) => e.id === selectedEventId);
    showConfirm({
      title: "Bulk Certificate Email Dispatch",
      message: `Are you sure you want to email verified certificates with PDF attachments to all ${totalAttended} attendees of "${currentEvent?.name}"?`,
      confirmLabel: "Dispatch All Emails",
      variant: "info",
      onConfirm: async () => {
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
      },
    });
  };

  // Derived state
  const activeEvent = events.find((e) => e.id === portalConfig?.active_event_id);
  const currentViewEvent = events.find((e) => e.id === selectedEventId);

  // Events filtered by filter chip and search
  const eventsFiltered = useMemo(() => {
    const q = eventsSearch.toLowerCase().trim();
    return events.filter((ev) => {
      const status = getEventStatus(ev, portalConfig?.active_event_id);

      if (eventsFilter === "active" && status !== "active") return false;
      if (eventsFilter === "upcoming" && status !== "upcoming") return false;
      if (eventsFilter === "concluded" && status !== "concluded") return false;
      if (eventsFilter === "tba" && status !== "tba") return false;

      if (!q) return true;
      return (
        ev.name.toLowerCase().includes(q) ||
        (ev.speaker_name && ev.speaker_name.toLowerCase().includes(q)) ||
        (ev.description && ev.description.toLowerCase().includes(q))
      );
    });
  }, [events, eventsFilter, eventsSearch, portalConfig?.active_event_id]);

  // Event counts for filter badges
  const eventCounts = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    let concluded = 0;
    let tba = 0;

    events.forEach((ev) => {
      const st = getEventStatus(ev, portalConfig?.active_event_id);
      if (st === "active") active++;
      else if (st === "upcoming") upcoming++;
      else if (st === "concluded") concluded++;
      else if (st === "tba") tba++;
    });

    return { total: events.length, active, upcoming, concluded, tba };
  }, [events, portalConfig?.active_event_id]);

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
        (p.certificateId &&
          p.certificateId.toLowerCase().includes(participantSearch.toLowerCase()));

      const matchesCourse =
        selectedCourseFilter === "ALL" || p.course === selectedCourseFilter;

      return matchesSearch && matchesCourse;
    });
  }, [participants, participantSearch, selectedCourseFilter]);

  const totalVerifiedCerts = useMemo(() => {
    return participants.filter((p) => Boolean(p.certificateId)).length;
  }, [participants]);

  return (
    <div
      className="min-h-screen text-[#F4F4F6] selection:bg-[#7C3AED]/30 pb-28 relative"
      style={{
        background: `
          radial-gradient(1200px 600px at 15% -5%, rgba(124, 58, 237, 0.12), transparent 70%),
          radial-gradient(1000px 500px at 85% 0%, rgba(255, 153, 0, 0.04), transparent 70%),
          linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px) 0 0 / 48px 48px,
          linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px) 0 0 / 48px 48px,
          #08080C
        `,
      }}
    >
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 1. STICKY EXECUTIVE COCKPIT HEADER ──────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#08080C]/95 backdrop-blur-2xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Left: AWS SBG Monogram & Portal Indicator */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="relative group">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#7C3AED]/30 via-indigo-600/20 to-amber-500/10 border border-white/10 flex items-center justify-center shadow-lg shadow-[#7C3AED]/10">
                <ShieldCheck className="w-5 h-5 text-[#A78BFA]" />
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#08080C] ${
                  portalConfig?.attendance_enabled && activeEvent?.attendance_open
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white font-display tracking-tight">
                  AWS Builder Group
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-white/[0.05] border border-white/[0.08] text-[#A1A1AA]">
                  Admin Cockpit
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    portalConfig?.attendance_enabled && activeEvent?.attendance_open
                      ? "bg-emerald-400 animate-ping"
                      : "bg-amber-400"
                  }`}
                />
                <span className="text-[11px] font-mono text-[#A1A1AA] tracking-wide">
                  {portalConfig?.attendance_enabled && activeEvent?.attendance_open
                    ? "Live Portal Active"
                    : "Portal Standby"}
                </span>
              </div>
            </div>
          </div>

          {/* Center: High-End Segmented Navigation Pills */}
          <nav className="hidden md:flex items-center p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-inner">
            <button
              onClick={() => setActiveTab("events")}
              className={`h-9 px-4 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                activeTab === "events"
                  ? "bg-[#7C3AED] text-white font-bold shadow-md shadow-[#7C3AED]/25"
                  : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Events & Sessions</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === "events" ? "bg-white/20 text-white" : "bg-white/[0.06] text-[#71717A]"
                }`}
              >
                {events.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("attendees")}
              className={`h-9 px-4 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                activeTab === "attendees"
                  ? "bg-[#7C3AED] text-white font-bold shadow-md shadow-[#7C3AED]/25"
                  : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Attendees & Credentials</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === "attendees"
                    ? "bg-white/20 text-white"
                    : "bg-white/[0.06] text-[#71717A]"
                }`}
              >
                {totalAttended}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("team")}
              className={`h-9 px-4 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                activeTab === "team"
                  ? "bg-[#7C3AED] text-white font-bold shadow-md shadow-[#7C3AED]/25"
                  : "text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Team Roster</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === "team" ? "bg-white/20 text-white" : "bg-white/[0.06] text-[#71717A]"
                }`}
              >
                {teamMembers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("overview")}
              className={`h-9 px-3.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "overview"
                  ? "bg-white/10 text-white font-bold"
                  : "text-[#71717A] hover:text-[#A1A1AA]"
              }`}
              title="Show all sections vertically"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full View</span>
            </button>
          </nav>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Refresh Button */}
            <button
              onClick={() => {
                fetchData(true);
                fetchTeamMembers();
              }}
              disabled={refreshing}
              title="Refresh Dashboard Data"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? "animate-spin text-[#A78BFA]" : ""}`}
              />
            </button>

            {/* View Public Website Link */}
            <Link
              href="/"
              target="_blank"
              className="h-9 sm:h-10 px-3.5 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all hidden sm:flex items-center gap-1.5"
              title="Open Public Website in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#71717A]" />
              <span>View Site</span>
            </Link>

            {/* Attendance Portal Link */}
            <Link
              href="/attendance"
              target="_blank"
              className="h-9 sm:h-10 px-3.5 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all hidden sm:flex items-center gap-1.5"
              title="View Public Attendance Portal"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-[#71717A]" />
              <span>Portal</span>
            </Link>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="h-9 sm:h-10 px-3.5 rounded-xl text-xs font-medium text-[#71717A] hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer bg-white/[0.02]"
              title="Sign Out of Admin Cockpit"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tab Bar */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-white/[0.04] pt-2.5">
          <button
            onClick={() => setActiveTab("events")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "events"
                ? "bg-[#7C3AED] text-white font-bold"
                : "bg-white/[0.03] text-[#A1A1AA]"
            }`}
          >
            Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab("attendees")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "attendees"
                ? "bg-[#7C3AED] text-white font-bold"
                : "bg-white/[0.03] text-[#A1A1AA]"
            }`}
          >
            Attendees ({totalAttended})
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "team"
                ? "bg-[#7C3AED] text-white font-bold"
                : "bg-white/[0.03] text-[#A1A1AA]"
            }`}
          >
            Team ({teamMembers.length})
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === "overview"
                ? "bg-white/10 text-white font-bold"
                : "bg-white/[0.03] text-[#71717A]"
            }`}
          >
            Full View
          </button>
        </div>
      </header>

      {/* ── Main Operations Container ───────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs sm:text-sm text-rose-400 flex items-center gap-3">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-36 space-y-4">
            <div className="w-10 h-10 rounded-full border-2 border-[#7C3AED]/30 border-t-[#7C3AED] animate-spin" />
            <p className="text-xs font-mono text-[#71717A] tracking-widest uppercase">
              Initializing Operations Cockpit…
            </p>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════ */}
            {/* ── 2. EXECUTIVE METRIC DECK (4 DOUBLE-BEZEL TILES) ─── */}
            {/* ══════════════════════════════════════════════════════ */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tile 1: Active Live Session */}
              <div className="p-1 rounded-[1.75rem] bg-white/[0.03] border border-white/[0.08] shadow-lg">
                <div className="p-5 rounded-[calc(1.75rem-4px)] bg-[#0C0C12] h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#71717A] font-semibold">
                        Live Portal Event
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          portalConfig?.attendance_enabled && activeEvent?.attendance_open
                            ? "bg-emerald-400 animate-ping"
                            : "bg-amber-400"
                        }`}
                      />
                    </div>
                    <p className="text-sm font-bold text-white truncate">
                      {activeEvent?.name || "None Configured"}
                    </p>
                    <p className="text-xs text-[#71717A] mt-0.5 truncate font-mono">
                      {activeEvent ? formatDate(activeEvent.event_date) : "Standby"}
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-[11px] text-[#A1A1AA]">
                      {portalConfig?.attendance_enabled && activeEvent?.attendance_open
                        ? "Submissions Open"
                        : "Submissions Paused"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAttendance(!portalConfig?.attendance_enabled)}
                      className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer p-0.5 ${
                        portalConfig?.attendance_enabled
                          ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                          : "bg-zinc-800"
                      }`}
                      title="Toggle live attendance submissions"
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-sm ${
                          portalConfig?.attendance_enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tile 2: Events Catalog Breakdown */}
              <div className="p-1 rounded-[1.75rem] bg-white/[0.03] border border-white/[0.08] shadow-lg">
                <div className="p-5 rounded-[calc(1.75rem-4px)] bg-[#0C0C12] h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#71717A] font-semibold">
                        Sessions Catalog
                      </span>
                      <Calendar className="w-4 h-4 text-[#A78BFA]" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-mono font-bold text-white">
                        {events.length}
                      </span>
                      <span className="text-xs text-[#71717A]">total</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04] flex items-center gap-2 text-[11px] font-mono text-[#A1A1AA]">
                    <span className="text-emerald-400 font-semibold">{eventCounts.upcoming} Upcoming</span>
                    <span>•</span>
                    <span className="text-[#71717A]">{eventCounts.concluded} Concluded</span>
                  </div>
                </div>
              </div>

              {/* Tile 3: Attendees & Credentials */}
              <div className="p-1 rounded-[1.75rem] bg-white/[0.03] border border-white/[0.08] shadow-lg">
                <div className="p-5 rounded-[calc(1.75rem-4px)] bg-[#0C0C12] h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#71717A] font-semibold">
                        Attendees In Scope
                      </span>
                      <Users className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-mono font-bold text-white">
                        {totalAttended}
                      </span>
                      <span className="text-xs text-[#71717A]">records</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-mono">
                      {totalVerifiedCerts} verified
                    </span>
                    <button
                      onClick={handleExportCSV}
                      disabled={participants.length === 0}
                      className="text-[#A78BFA] hover:text-white font-mono flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Download className="w-3 h-3" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tile 4: Team Directory */}
              <div className="p-1 rounded-[1.75rem] bg-white/[0.03] border border-white/[0.08] shadow-lg">
                <div className="p-5 rounded-[calc(1.75rem-4px)] bg-[#0C0C12] h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-[#71717A] font-semibold">
                        Team Roster
                      </span>
                      <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-mono font-bold text-white">
                        {teamMembers.length}
                      </span>
                      <span className="text-xs text-[#71717A]">builders</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px]">
                    <span className="text-[#A1A1AA] font-mono">
                      Batch {selectedTeamBatch || "2026-27"}
                    </span>
                    <button
                      onClick={() => startCreateTeamMember(selectedTeamBatch)}
                      className="text-amber-400 hover:text-amber-300 font-mono flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── 3. WORKSPACE: SESSIONS & EVENTS ─────────────────── */}
            {/* ══════════════════════════════════════════════════════ */}
            {(activeTab === "events" || activeTab === "overview") && (
              <section className="space-y-6">
                {/* ── ACTIVE SESSION SPOTLIGHT (DOUBLE-BEZEL) ────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[10px] font-mono uppercase tracking-wider text-[#A78BFA] mb-2 font-medium">
                      <Radio className="w-3 h-3 text-[#A78BFA] animate-pulse" />
                      <span>Real-Time Session Controller</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                      Active Portal Session
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={startCreate}
                      className="h-10 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:brightness-110 text-white transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-[#7C3AED]/25 active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New Session</span>
                    </button>
                  </div>
                </div>

                {activeEvent ? (
                  <div className="p-1 rounded-[2rem] bg-white/[0.04] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                    <div className="p-6 sm:p-8 rounded-[calc(2rem-4px)] bg-gradient-to-b from-[#0F0F16] to-[#0A0A0F] space-y-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="space-y-3 max-w-2xl">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                              Live Broadcasted Session
                            </span>
                          </div>

                          <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
                            {activeEvent.name}
                          </h3>

                          {activeEvent.description && (
                            <p className="text-sm text-[#A1A1AA] leading-relaxed">
                              {activeEvent.description}
                            </p>
                          )}

                          {/* Metadata Badges */}
                          <div className="flex flex-wrap gap-2.5 pt-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#D4D4D8]">
                              <Calendar className="w-3.5 h-3.5 text-[#A78BFA]" />
                              <span>{formatDate(activeEvent.event_date)}</span>
                            </div>

                            {activeEvent.event_timing ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#D4D4D8]">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
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
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{activeEvent.speaker_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Quick Controls */}
                        <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2.5 shrink-0">
                          <button
                            onClick={() => handleInspectAttendees(activeEvent.id)}
                            className="h-10 px-4 rounded-xl text-xs font-semibold whitespace-nowrap text-white bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 border border-[#7C3AED]/40 transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
                          >
                            <Users className="w-3.5 h-3.5 text-[#A78BFA]" />
                            <span>Inspect Attendees</span>
                          </button>

                          <button
                            onClick={() => startEdit(activeEvent)}
                            className="h-10 px-4 rounded-xl text-xs font-medium whitespace-nowrap text-[#D4D4D8] hover:text-white bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#A78BFA]" />
                            <span>Edit Session Details</span>
                          </button>

                          <Link
                            href="/attendance"
                            target="_blank"
                            className="h-10 px-4 rounded-xl text-xs font-medium whitespace-nowrap text-[#A1A1AA] hover:text-white bg-transparent hover:bg-white/[0.04] border border-white/[0.06] transition-all flex items-center gap-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Preview Student Portal</span>
                          </Link>
                        </div>
                      </div>

                      {/* Master Switch Bar (Nested Hardware Island) */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#13131B] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                              portalConfig?.attendance_enabled
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-zinc-800/50 border-zinc-700 text-zinc-400"
                            }`}
                          >
                            <Radio className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">
                                Live Attendance Gate
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                                  portalConfig?.attendance_enabled
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                }`}
                              >
                                {portalConfig?.attendance_enabled
                                  ? "OPEN & ACCEPTING SUBMISSIONS"
                                  : "CLOSED / PAUSED"}
                              </span>
                            </div>
                            <p className="text-xs text-[#71717A] mt-0.5">
                              {portalConfig?.attendance_enabled
                                ? "Students can scan the session QR code to submit attendance and earn certificates."
                                : "Attendance submissions are temporarily suspended for this session."}
                            </p>
                          </div>
                        </div>

                        {/* Machined Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => toggleAttendance(!portalConfig?.attendance_enabled)}
                          className={`relative w-14 h-8 rounded-full transition-all duration-300 cursor-pointer shrink-0 p-1 ${
                            portalConfig?.attendance_enabled
                              ? "bg-emerald-500 shadow-lg shadow-emerald-500/25"
                              : "bg-[#27272A]"
                          }`}
                        >
                          <span
                            className={`block w-6 h-6 rounded-full bg-white transition-transform duration-300 shadow-md ${
                              portalConfig?.attendance_enabled ? "translate-x-6" : "translate-x-0"
                            }`}
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
                    <h3 className="text-base font-semibold text-white mb-1 font-display">
                      No active portal event configured
                    </h3>
                    <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-5">
                      Select a session from the catalog below or schedule a new event to activate
                      the student portal.
                    </p>
                    <button
                      onClick={startCreate}
                      className="h-10 px-5 rounded-xl text-xs font-semibold bg-[#7C3AED] hover:brightness-110 text-white transition-all cursor-pointer shadow-lg shadow-[#7C3AED]/20"
                    >
                      Create Your First Event
                    </button>
                  </div>
                )}

                {/* ── ALL SESSIONS CATALOG & BENTO GRID ─────────────── */}
                <div className="space-y-4 pt-4">
                  {/* Catalog Header with Search & Filter Chips */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight font-display">
                        Events &amp; Workshops Catalog
                      </h3>
                      <p className="text-xs text-[#71717A]">
                        Filter by lifecycle status or search topics and keynote speakers
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Search Bar */}
                      <div className="relative min-w-[200px] sm:w-64">
                        <Search className="w-4 h-4 text-[#52525B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={eventsSearch}
                          onChange={(e) => setEventsSearch(e.target.value)}
                          placeholder="Search sessions…"
                          className="w-full h-9 pl-9 pr-8 rounded-xl text-xs bg-[#111117] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#7C3AED] transition-colors"
                        />
                        {eventsSearch && (
                          <button
                            onClick={() => setEventsSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Filter Status Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => setEventsFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        eventsFilter === "all"
                          ? "bg-[#7C3AED] text-white font-bold shadow-md shadow-[#7C3AED]/20"
                          : "bg-white/[0.03] text-[#71717A] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      <span>All Sessions</span>
                      <span className="text-[10px] opacity-75">({eventCounts.total})</span>
                    </button>

                    <button
                      onClick={() => setEventsFilter("active")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        eventsFilter === "active"
                          ? "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20"
                          : "bg-white/[0.03] text-[#71717A] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Active</span>
                      <span className="text-[10px] opacity-75">({eventCounts.active})</span>
                    </button>

                    <button
                      onClick={() => setEventsFilter("upcoming")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        eventsFilter === "upcoming"
                          ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20"
                          : "bg-white/[0.03] text-[#71717A] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      <span>Upcoming</span>
                      <span className="text-[10px] opacity-75">({eventCounts.upcoming})</span>
                    </button>

                    <button
                      onClick={() => setEventsFilter("concluded")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        eventsFilter === "concluded"
                          ? "bg-zinc-700 text-white font-bold"
                          : "bg-white/[0.03] text-[#71717A] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      <span>Concluded</span>
                      <span className="text-[10px] opacity-75">({eventCounts.concluded})</span>
                    </button>

                    <button
                      onClick={() => setEventsFilter("tba")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        eventsFilter === "tba"
                          ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                          : "bg-white/[0.03] text-[#71717A] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      <span>TBA</span>
                      <span className="text-[10px] opacity-75">({eventCounts.tba})</span>
                    </button>
                  </div>

                  {/* Sessions Bento Grid */}
                  {eventsFiltered.length === 0 ? (
                    <div className="p-1 rounded-[1.75rem] bg-white/[0.02] border border-dashed border-white/10 p-12 text-center">
                      <Calendar className="w-8 h-8 mx-auto text-[#71717A] mb-3" />
                      <p className="text-sm font-semibold text-white">No sessions match your filter</p>
                      <p className="text-xs text-[#71717A] mt-1">
                        Try clearing your search query or switching filter tabs.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {eventsFiltered.map((event) => {
                        const isActive = event.id === portalConfig?.active_event_id;
                        const isInspecting = event.id === selectedEventId;
                        const status = getEventStatus(event, portalConfig?.active_event_id);

                        return (
                          <div
                            key={event.id}
                            className={`p-1 rounded-[1.75rem] border transition-all duration-300 flex flex-col justify-between ${
                              isActive
                                ? "bg-[#7C3AED]/10 border-[#7C3AED]/40 shadow-lg shadow-[#7C3AED]/10"
                                : isInspecting
                                ? "bg-white/[0.06] border-white/20"
                                : "bg-white/[0.02] border-white/[0.06] hover:border-white/15"
                            }`}
                          >
                            <div className="p-5 rounded-[calc(1.75rem-4px)] bg-[#0C0C12] h-full flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                {/* Top Badge & Actions Row */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {status === "active" && (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Active Portal
                                      </span>
                                    )}
                                    {status === "upcoming" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                        Upcoming
                                      </span>
                                    )}
                                    {status === "concluded" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                                        Concluded
                                      </span>
                                    )}
                                    {status === "tba" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        Date TBA
                                      </span>
                                    )}

                                    {isInspecting && (
                                      <span className="text-[10px] font-mono text-[#A78BFA] bg-[#7C3AED]/10 px-2 py-0.5 rounded whitespace-nowrap">
                                        Selected
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => startEdit(event)}
                                      title="Edit Event Details"
                                      className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteEvent(event)}
                                      title="Delete Event"
                                      className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Title & Description */}
                                <div>
                                  <h4 className="text-base font-bold text-white tracking-tight line-clamp-1 font-display">
                                    {event.name}
                                  </h4>
                                  {event.description && (
                                    <p className="text-xs text-[#71717A] line-clamp-2 mt-1 leading-relaxed">
                                      {event.description}
                                    </p>
                                  )}
                                </div>

                                {/* Meta details */}
                                <div className="space-y-1.5 pt-1 text-xs text-[#A1A1AA]">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                    <span className="font-mono text-[11px] truncate">
                                      {formatDate(event.event_date)}
                                    </span>
                                  </div>
                                  {event.event_timing && (
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                      <span className="font-mono text-[11px] truncate">
                                        {event.event_timing}
                                      </span>
                                    </div>
                                  )}
                                  {event.speaker_name && (
                                    <div className="flex items-center gap-2">
                                      <User className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                                      <span className="truncate text-[11px]">
                                        {event.speaker_name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Action Tray */}
                              <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2">
                                <button
                                  onClick={() => handleInspectAttendees(event.id)}
                                  className="h-8.5 px-3 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-[#D4D4D8] hover:text-white border border-white/[0.06] transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Users className="w-3 h-3 text-[#A78BFA]" />
                                  <span>Inspect Attendees</span>
                                </button>

                                {!isActive ? (
                                  <button
                                    onClick={() => handleSetActiveEvent(event)}
                                    className="h-8.5 px-3 rounded-xl text-xs font-semibold bg-[#7C3AED]/15 hover:bg-[#7C3AED]/25 text-[#A78BFA] hover:text-white border border-[#7C3AED]/30 transition-all cursor-pointer flex items-center gap-1"
                                    title="Set as active portal session"
                                  >
                                    <Radio className="w-3 h-3" />
                                    <span>Set Active</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-mono text-emerald-400 font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    Live Now
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── 4. WORKSPACE: ATTENDEES & CREDENTIALS ──────────── */}
            {/* ══════════════════════════════════════════════════════ */}
            {(activeTab === "attendees" || activeTab === "overview") && (
              <section
                ref={attendeesSectionRef}
                className="space-y-6 pt-4 border-t border-white/[0.06]"
              >
                {/* Header & Session Selector Ribbon */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono uppercase tracking-wider text-cyan-400 mb-2 font-medium">
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span>Verified Attendance Registry</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                        Attendee Directory &amp; Credentials
                      </h2>
                      {currentViewEvent && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-[#A78BFA]">
                          {currentViewEvent.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#71717A] mt-1">
                      Student attendance check-ins and cryptographic credential issuance
                    </p>
                  </div>

                  {/* Actions & Selector Tray */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Event Selector Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedEventId}
                        onChange={(e) => {
                          setSelectedEventId(e.target.value);
                          setInspectingEventId(e.target.value);
                        }}
                        className="h-10 pl-3.5 pr-8 rounded-xl text-xs bg-[#111117] border border-white/[0.1] text-white focus:outline-none focus:border-[#7C3AED] transition-colors cursor-pointer appearance-none font-mono"
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
                      className="h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                      title="Export Attendees to CSV"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Export CSV</span>
                    </button>

                    {/* Bulk Email Certificates Button */}
                    <button
                      onClick={handleBulkSendEmails}
                      disabled={participants.length === 0}
                      className="h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#A78BFA] hover:text-white border border-[#7C3AED]/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                      title="Email Certificates to all attendees"
                    >
                      <Send className="w-4 h-4 text-[#A78BFA]" />
                      <span>Email All Certificates</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar & Course Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="Search student, roll number, email, or certificate ID…"
                      className="w-full h-10 pl-10 pr-9 rounded-xl text-xs bg-[#111117] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#7C3AED] transition-colors"
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

                  {courseOptions.length > 2 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                      <span className="text-[11px] font-mono text-[#71717A] uppercase mr-1">
                        Course:
                      </span>
                      {courseOptions.map((c) => (
                        <button
                          key={c}
                          onClick={() => setSelectedCourseFilter(c)}
                          className={`h-8 px-3 rounded-lg text-[11px] font-mono uppercase whitespace-nowrap transition-all cursor-pointer ${
                            selectedCourseFilter === c
                              ? "bg-[#7C3AED] text-white font-bold"
                              : "bg-white/[0.03] text-[#71717A] hover:text-white hover:bg-white/[0.06] border border-white/[0.06]"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── PARTICIPANTS TABLE CONTAINER (DOUBLE-BEZEL) ─── */}
                <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-white/10 shadow-2xl overflow-hidden">
                  <div className="rounded-[calc(2rem-4px)] bg-[#0C0C10] overflow-hidden">
                    {loadingParticipants ? (
                      <div className="py-28 text-center space-y-3">
                        <div className="w-8 h-8 mx-auto rounded-full border-2 border-[#7C3AED]/30 border-t-[#7C3AED] animate-spin" />
                        <p className="text-xs text-[#71717A] font-mono">
                          Querying verified attendance database…
                        </p>
                      </div>
                    ) : filteredParticipants.length === 0 ? (
                      <div className="py-24 text-center px-4 max-w-md mx-auto space-y-3">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[#71717A]">
                          <Users className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-white font-display">
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
                              <th className="py-4 px-5">Participant</th>
                              <th className="py-4 px-4">Contact</th>
                              <th className="py-4 px-4">Academic Details</th>
                              <th className="py-4 px-4">Check-in Time</th>
                              <th className="py-4 px-4">Certificate ID</th>
                              <th className="py-4 px-5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {filteredParticipants.map((p, idx) => (
                              <tr
                                key={`${p.email}-${idx}`}
                                className="hover:bg-white/[0.025] transition-colors group"
                              >
                                {/* Participant Name + Roll */}
                                <td className="py-4 px-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7C3AED]/20 to-[#A78BFA]/20 border border-[#7C3AED]/30 flex items-center justify-center text-[10px] font-bold text-[#A78BFA] shrink-0 font-mono">
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

                                {/* Email with quick copy */}
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
                                          handleCopy(
                                            p.certificateId!,
                                            `cert-${idx}`,
                                            "Certificate ID"
                                          )
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

                                {/* Actions Tray */}
                                <td className="py-4 px-5 text-right whitespace-nowrap">
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
                                          onClick={() =>
                                            handleSendSingleEmail(p.certificateId!, p.email)
                                          }
                                          className="h-7 w-7 rounded-lg bg-white/[0.03] hover:bg-[#7C3AED]/20 text-[#A1A1AA] hover:text-[#A78BFA] border border-white/[0.06] hover:border-[#7C3AED]/30 flex items-center justify-center transition-colors cursor-pointer"
                                          title="Email Certificate with PDF Attachment"
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}

                                    {/* Remove participant button */}
                                    <button
                                      onClick={() => handleRemoveParticipant(p)}
                                      disabled={
                                        deletingParticipantKey === (p.attendanceId || p.email)
                                      }
                                      className="h-7 w-7 rounded-lg bg-white/[0.03] hover:bg-rose-500/20 text-[#71717A] hover:text-rose-400 border border-white/[0.06] hover:border-rose-500/30 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                                      title="Remove Participant & Certificate"
                                    >
                                      {deletingParticipantKey === (p.attendanceId || p.email) ? (
                                        <div className="w-3 h-3 rounded-full border border-rose-400/30 border-t-rose-400 animate-spin" />
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
            )}

            {/* ══════════════════════════════════════════════════════ */}
            {/* ── 5. WORKSPACE: TEAM ROSTER & COHORTS ────────────── */}
            {/* ══════════════════════════════════════════════════════ */}
            {(activeTab === "team" || activeTab === "overview") && (
              <section className="space-y-6 pt-4 border-t border-white/[0.06]">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono uppercase tracking-wider text-amber-400 mb-2 font-medium">
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>AWS Student Builder Cohorts</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                      Team Roster &amp; Leadership
                    </h2>
                    <p className="text-xs text-[#71717A] mt-1">
                      Manage builders, core organizers, and tenure batches for the chapter
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-amber-400 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      {teamMembers.length} Total Members
                    </span>
                    <button
                      onClick={handleCreateNewBatch}
                      className="h-10 px-3.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                      title="Form a new team for the next cohort"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>New Cohort</span>
                    </button>
                  </div>
                </div>

                {/* Cohort Tabs & Search Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#0B0B10] border border-white/[0.06]">
                  {/* Cohort Tabs */}
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
                              ? "bg-amber-400 text-black font-bold shadow-md shadow-amber-400/25"
                              : "bg-[#14141C] text-[#A1A1AA] hover:text-white border border-white/[0.06] hover:border-white/[0.12]"
                          }`}
                        >
                          <span>{b}</span>
                          {isCurrent && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-bold ${
                                isSelected ? "bg-black/20 text-black" : "bg-amber-400/20 text-amber-300"
                              }`}
                            >
                              Current
                            </span>
                          )}
                          <span
                            className={`text-[10px] ${
                              isSelected ? "text-black/75" : "text-[#71717A]"
                            }`}
                          >
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
                      placeholder="Search member, role, branch…"
                      className="w-full h-9 pl-9 pr-8 rounded-xl text-xs bg-[#14141C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 transition-colors"
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

                {/* Team Members List */}
                {loadingTeamMembers ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <div className="w-8 h-8 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                    <p className="text-xs text-[#71717A] font-mono">Loading team roster…</p>
                  </div>
                ) : groupedTeamMembers.length === 0 ? (
                  <div className="p-1 rounded-[2rem] bg-white/[0.03] border border-dashed border-white/10">
                    <div className="p-12 rounded-[calc(2rem-4px)] bg-[#0D0D12] text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#71717A]">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-white mb-1 font-display">
                        {teamSearch
                          ? "No matching team members found"
                          : `No members added to Batch ${selectedTeamBatch} yet`}
                      </h3>
                      <p className="text-xs text-[#71717A] max-w-sm mx-auto mb-5">
                        {teamSearch
                          ? "Try clearing your search query."
                          : `Start building your ${selectedTeamBatch} roster by adding your first builder.`}
                      </p>
                      <button
                        onClick={() => startCreateTeamMember(selectedTeamBatch)}
                        className="h-10 px-5 rounded-xl text-xs font-semibold bg-amber-400 text-black hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-amber-400/20"
                      >
                        Add Member to Batch {selectedTeamBatch}
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
                          {/* Batch Separator Bar */}
                          <div className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-[#12121A] via-[#101017] to-[#0D0D12] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 border ${
                                  isCurrent
                                    ? "bg-amber-400/15 border-amber-400/30 text-amber-400"
                                    : isUpcoming
                                    ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                                    : "bg-white/[0.05] border-white/[0.1] text-[#A1A1AA]"
                                }`}
                              >
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-display">
                                    Batch {group.batch}
                                  </h3>
                                  {isCurrent && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                      Current Active Team
                                    </span>
                                  )}
                                  {isUpcoming && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                      Next Cohort
                                    </span>
                                  )}
                                  {isPrevious && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">
                                      Alumni
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#71717A] mt-0.5">
                                  {group.members.length}{" "}
                                  {group.members.length === 1 ? "builder" : "builders"} in this
                                  cohort
                                </p>
                              </div>
                            </div>

                            {/* Batch Action Buttons */}
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
                                title={`Import members into Batch ${group.batch}`}
                              >
                                <Table2 className="w-3.5 h-3.5" />
                                <span>Import Excel</span>
                              </button>
                              <button
                                onClick={() => startCreateTeamMember(group.batch)}
                                className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-400/20 active:scale-[0.98]"
                                title={`Add member to Batch ${group.batch}`}
                              >
                                <UserPlus className="w-3.5 h-3.5 text-black" />
                                <span>Add Member</span>
                              </button>
                            </div>
                          </div>

                          {/* Member Cards Grid (Double-Bezel) */}
                          {group.members.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-[#0D0D12] border border-dashed border-white/10 text-center space-y-3">
                              <p className="text-xs text-[#71717A]">
                                No team members added to Batch {group.batch} yet.
                              </p>
                              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                                <button
                                  onClick={() => startCreateTeamMember(group.batch)}
                                  className="h-8.5 px-4 rounded-xl text-xs font-semibold bg-amber-400 text-black hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-400/20"
                                >
                                  <UserPlus className="w-3.5 h-3.5 text-black" />
                                  <span>Add First Member</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {group.members.map((member) => (
                                <div
                                  key={member.id}
                                  className="group p-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-400/30 transition-all duration-300 flex flex-col justify-between hover:shadow-lg hover:shadow-amber-400/5"
                                >
                                  <div className="p-4.5 rounded-[calc(1rem-2px)] bg-[#0E0E13] h-full flex flex-col justify-between space-y-3">
                                    <div>
                                      {/* Avatar & Action Tray */}
                                      <div className="flex items-center justify-between gap-2.5">
                                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.08] bg-gradient-to-tr from-amber-400/15 to-purple-500/15 flex items-center justify-center shrink-0">
                                          {member.pic_url ? (
                                            <img
                                              src={member.pic_url}
                                              alt={member.name}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).style.display =
                                                  "none";
                                                (
                                                  e.target as HTMLImageElement
                                                ).nextElementSibling?.classList.remove("hidden");
                                              }}
                                            />
                                          ) : null}
                                          <span
                                            className={`text-xs font-bold text-amber-400 font-mono ${
                                              member.pic_url ? "hidden" : ""
                                            }`}
                                          >
                                            {getInitials(member.name)}
                                          </span>
                                        </div>

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
                                            className="h-7 w-7 rounded-lg flex items-center justify-center text-[#71717A] hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer disabled:opacity-40"
                                          >
                                            {deletingTeamMemberId === member.id ? (
                                              <div className="w-3 h-3 rounded-full border border-rose-400/30 border-t-rose-400 animate-spin" />
                                            ) : (
                                              <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Identity */}
                                      <div className="mt-3 min-w-0">
                                        <h4 className="text-[14px] font-semibold text-white group-hover:text-amber-300 transition-colors truncate tracking-tight font-display">
                                          {member.name}
                                        </h4>
                                        <div className="mt-1">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-400/10 text-amber-300 border border-amber-400/20 max-w-full">
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
                                          <span className="truncate text-[11px] text-[#71717A] font-mono">
                                            {member.year}
                                          </span>
                                        </div>
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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 6. MODALS (FROSTED GLASS HARDWARE ENCLOSURES) ──────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {/* ── MODAL 1: CREATE / EDIT EVENT ────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain animate-in fade-in duration-200"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
            onClick={resetForm}
          />
          <div
            className="relative w-full max-w-xl p-1 rounded-[2rem] bg-white/[0.05] border border-white/10 shadow-2xl overflow-hidden my-auto z-10"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-4px)] bg-[#0F0F16] overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-6 sm:px-7 py-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight font-display">
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

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div
                  className="p-6 sm:p-7 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
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
                      Event Title <span className="text-[#7C3AED]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Cloud Kickstart 2026: AWS Architecture"
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30 transition-all"
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
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Brief overview of topics covered, cloud services explored, and student takeaways."
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30 transition-all resize-none leading-relaxed"
                    />
                  </div>

                  {/* Date & Timing Grid */}
                  <div
                    className={cn(
                      "grid gap-4",
                      isTBA ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between min-h-[20px]">
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                          Event Date {!isTBA && <span className="text-[#7C3AED]">*</span>}
                        </label>
                      </div>

                      {isTBA ? (
                        <div
                          onClick={() => handleToggleTBA(false)}
                          className="w-full h-11 px-3.5 rounded-xl bg-[#15151C]/80 border border-dashed border-[#7C3AED]/40 hover:border-[#7C3AED] text-white flex items-center justify-between cursor-pointer transition-all group"
                          title="Click to specify date and timing"
                        >
                          <div className="flex items-center gap-2.5">
                            <Calendar className="w-4 h-4 text-[#A78BFA]" />
                            <span className="text-xs sm:text-sm text-[#E4E4E7] font-medium">
                              Date & Timing to be announced
                            </span>
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#7C3AED]/15 text-[#A78BFA] border border-[#7C3AED]/30 font-semibold group-hover:bg-[#7C3AED]/25 transition-colors">
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

                    {!isTBA && (
                      <div className="space-y-2">
                        <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium min-h-[20px] flex items-center">
                          Timing <span className="text-[#7C3AED] ml-1">*</span>
                        </label>
                        <input
                          type="text"
                          required={!isTBA}
                          value={formData.eventTiming}
                          onChange={(e) =>
                            setFormData({ ...formData, eventTiming: e.target.value })
                          }
                          placeholder="e.g. 11:00 AM - 12:30 PM"
                          className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30 transition-all font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* Speaker Name */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Keynote Speaker / Host
                      </label>
                      <span className="text-[11px] text-[#71717A]">Optional</span>
                    </div>
                    <input
                      type="text"
                      value={formData.speakerName}
                      onChange={(e) =>
                        setFormData({ ...formData, speakerName: e.target.value })
                      }
                      placeholder="e.g. Sarah Connor, AWS Community Hero"
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/30 transition-all"
                    />
                  </div>

                  {/* Checkbox Options */}
                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.attendanceOpen}
                        onChange={(e) =>
                          setFormData({ ...formData, attendanceOpen: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#7C3AED] bg-black/40 border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Accept Attendance for this session
                        </span>
                        <span className="text-[11px] text-[#71717A] block">
                          Allows students to register check-ins when this event is active
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.setAsActive}
                        onChange={(e) =>
                          setFormData({ ...formData, setAsActive: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#7C3AED] bg-black/40 border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Set as Current Active Portal Event
                        </span>
                        <span className="text-[11px] text-[#71717A] block">
                          Immediately activates this session on the public Attendance Portal
                        </span>
                      </div>
                    </label>
                  </div>

                  {formError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-7 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-10 px-4 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="h-10 px-5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:brightness-110 text-white transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-[#7C3AED]/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingEvent ? "Save Changes" : "Create Session"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD / EDIT TEAM MEMBER ─────────────────────── */}
      {showTeamForm && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain animate-in fade-in duration-200"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
            onClick={resetTeamForm}
          />
          <div
            className="relative w-full max-w-xl p-1 rounded-[2rem] bg-white/[0.05] border border-white/10 shadow-2xl overflow-hidden my-auto z-10"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-4px)] bg-[#0F0F16] overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-6 sm:px-7 py-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight font-display">
                    {editingTeamMember ? "Edit Team Member" : "Add Team Member"}
                  </h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    {editingTeamMember
                      ? "Update builder profile and role assignment"
                      : `Add a student builder to Batch ${teamFormData.batch || "2026-27"}`}
                  </p>
                </div>
                <button
                  onClick={resetTeamForm}
                  className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form
                onSubmit={handleTeamFormSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
              >
                <div
                  className="p-6 sm:p-7 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
                  }}
                  data-lenis-prevent
                  onWheel={(e) => e.stopPropagation()}
                >
                  {/* Photo Upload Zone */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Profile Photo
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={() => setImageInputMode("upload")}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            imageInputMode === "upload"
                              ? "bg-amber-400/20 text-amber-300 font-bold"
                              : "text-[#71717A] hover:text-white"
                          }`}
                        >
                          Upload
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setImageInputMode("url")}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            imageInputMode === "url"
                              ? "bg-amber-400/20 text-amber-300 font-bold"
                              : "text-[#71717A] hover:text-white"
                          }`}
                        >
                          Image URL
                        </button>
                      </div>
                    </div>

                    {imageInputMode === "upload" ? (
                      <div
                        onDragOver={handlePicDragOver}
                        onDragLeave={handlePicDragLeave}
                        onDrop={handlePicDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-4 rounded-xl border border-dashed transition-all cursor-pointer flex items-center gap-4 ${
                          picDragActive
                            ? "bg-amber-400/10 border-amber-400"
                            : "bg-[#14141C] border-white/10 hover:border-white/20"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                        />

                        {teamFormData.picUrl ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/15 shrink-0 bg-black">
                            <img
                              src={teamFormData.picUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#71717A] shrink-0">
                            {uploadingPic ? (
                              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                            ) : (
                              <Camera className="w-5 h-5" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white">
                            {uploadingPic
                              ? "Uploading image…"
                              : teamFormData.picUrl
                              ? "Change photo (Drag or Click)"
                              : "Upload photo (PNG, JPG, WebP)"}
                          </p>
                          <p className="text-[11px] text-[#71717A] mt-0.5">
                            Max 5MB. Clear face portrait recommended.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={teamFormData.picUrl}
                        onChange={(e) =>
                          setTeamFormData({ ...teamFormData, picUrl: e.target.value })
                        }
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all font-mono text-xs"
                      />
                    )}

                    {picUploadError && (
                      <p className="text-xs text-rose-400 font-mono mt-1">{picUploadError}</p>
                    )}
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                      Full Name <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={teamFormData.name}
                      onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                      placeholder="e.g. Alex Sharma"
                      className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                    />
                  </div>

                  {/* Role */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                      Role / Position <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={teamFormData.role}
                      onChange={(e) => setTeamFormData({ ...teamFormData, role: e.target.value })}
                      placeholder="e.g. Chapter Lead / Technical Lead / Cloud Architect"
                      className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                    />
                  </div>

                  {/* Course & Branch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Course <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.course}
                        onChange={(e) =>
                          setTeamFormData({ ...teamFormData, course: e.target.value })
                        }
                        placeholder="e.g. B.Tech"
                        className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Branch / Dept <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.branch}
                        onChange={(e) =>
                          setTeamFormData({ ...teamFormData, branch: e.target.value })
                        }
                        placeholder="e.g. CSE / IT / ECE"
                        className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Year & Batch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Academic Year <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.year}
                        onChange={(e) =>
                          setTeamFormData({ ...teamFormData, year: e.target.value })
                        }
                        placeholder="e.g. 3rd Year"
                        className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                        Tenure Batch <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={teamFormData.batch}
                        onChange={(e) =>
                          setTeamFormData({ ...teamFormData, batch: e.target.value })
                        }
                        placeholder="e.g. 2026-27"
                        className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Display Order */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] font-medium">
                      Display Order Rank
                    </label>
                    <input
                      type="number"
                      value={teamFormData.displayOrder}
                      onChange={(e) =>
                        setTeamFormData({
                          ...teamFormData,
                          displayOrder: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      placeholder="0"
                      className="w-full h-10 px-3.5 rounded-xl text-sm bg-[#15151C] border border-white/[0.08] text-white placeholder-[#52525B] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all font-mono"
                    />
                    <p className="text-[11px] text-[#71717A]">
                      Lower values appear first on the public Team page.
                    </p>
                  </div>

                  {teamFormError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{teamFormError}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 sm:px-7 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={resetTeamForm}
                    className="h-10 px-4 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={teamFormSubmitting}
                    className="h-10 px-5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-400/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {teamFormSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingTeamMember ? "Save Profile" : "Add to Roster"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: BULK IMPORT EXCEL / CSV ───────────────────── */}
      {showBulkImport && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain animate-in fade-in duration-200"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
            onClick={() => setShowBulkImport(false)}
          />
          <div
            className="relative w-full max-w-2xl p-1 rounded-[2rem] bg-white/[0.05] border border-white/10 shadow-2xl overflow-hidden my-auto z-10"
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="rounded-[calc(2rem-4px)] bg-[#0F0F16] overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-6 sm:px-7 py-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight font-display">
                    Import Team Members via Excel / CSV
                  </h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Batch upload student builders to Cohort {bulkImportBatch}
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="h-8 w-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div
                className="p-6 sm:p-7 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
                }}
                data-lenis-prevent
                onWheel={(e) => e.stopPropagation()}
              >
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setBulkDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setBulkDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setBulkDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleBulkFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => bulkFileInputRef.current?.click()}
                  className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                    bulkDragActive
                      ? "bg-emerald-500/10 border-emerald-400"
                      : "bg-[#14141C] border-white/10 hover:border-white/20"
                  }`}
                >
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.ods"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleBulkFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <Table2 className="w-6 h-6" />
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {bulkImportFileName ? bulkImportFileName : "Click or drag spreadsheet here"}
                  </p>
                  <p className="text-xs text-[#71717A] mt-1">
                    Supports .xlsx, .xls, .csv, and .ods files
                  </p>
                </div>

                {/* Import Mode Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#14141C] border border-white/[0.06]">
                  <div>
                    <span className="text-xs font-semibold text-white block">Import Mode</span>
                    <span className="text-[11px] text-[#71717A]">
                      {bulkImportMode === "append"
                        ? "Append new rows to existing batch members"
                        : "Overwrite all existing records in this cohort"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setBulkImportMode("append")}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        bulkImportMode === "append"
                          ? "bg-emerald-500 text-black font-bold"
                          : "text-[#71717A] hover:text-white"
                      }`}
                    >
                      Append
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkImportMode("overwrite")}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        bulkImportMode === "overwrite"
                          ? "bg-rose-500 text-white font-bold"
                          : "text-[#71717A] hover:text-white"
                      }`}
                    >
                      Overwrite
                    </button>
                  </div>
                </div>

                {/* Validation Preview / Errors */}
                {bulkImportRows.length > 0 && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{bulkImportRows.length} valid row(s) ready to import</span>
                    </div>
                  </div>
                )}

                {bulkImportErrors.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Validation Errors ({bulkImportErrors.length}):</span>
                    </div>
                    <ul className="text-[11px] font-mono text-rose-300 list-disc list-inside max-h-32 overflow-y-auto space-y-0.5">
                      {bulkImportErrors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {bulkImportErrors.length > 10 && (
                        <li>…and {bulkImportErrors.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 sm:px-7 py-4 border-t border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBulkImport(false)}
                  className="h-10 px-4 rounded-xl text-xs font-semibold text-[#A1A1AA] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImportSubmit}
                  disabled={bulkImporting || bulkImportRows.length === 0 || bulkImportErrors.length > 0}
                  className="h-10 px-5 rounded-xl text-xs font-semibold bg-emerald-500 hover:brightness-110 text-black transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-40"
                >
                  {bulkImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm &amp; Import ({bulkImportRows.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CUSTOM CONFIRMATION DIALOG ──────────────────── */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center overscroll-contain animate-in fade-in duration-150"
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
            onClick={closeConfirm}
          />
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
                  : confirmModal.variant === "create"
                  ? "via-amber-400/70"
                  : "via-[#7C3AED]/70"
              } to-transparent`}
            />

            {/* Header with Icon badge */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmModal.variant === "danger"
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/10"
                    : confirmModal.variant === "create"
                    ? "bg-amber-400/10 border-amber-400/20 text-amber-400 shadow-lg shadow-amber-400/10"
                    : "bg-[#7C3AED]/10 border-[#7C3AED]/20 text-[#A78BFA] shadow-lg shadow-[#7C3AED]/10"
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

            {/* Title & Message */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight font-display">
                {confirmModal.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-[#A1A1AA] leading-relaxed whitespace-pre-line">
                {confirmModal.message}
              </p>
            </div>

            {/* Footer Buttons */}
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
                    : confirmModal.variant === "create"
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-black shadow-amber-400/20"
                    : "bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:brightness-110 shadow-[#7C3AED]/20"
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
