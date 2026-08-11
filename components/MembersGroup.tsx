"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { db } from "@/lib/firebase";
import MemberPicker from "@/components/MemberPicker";
import {
  joinGroup,
  removeMember,
  subscribeToGroupMembers,
  type GroupType,
  type Member,
} from "@/lib/members";
import { isPaid, setPaymentStatus } from "@/lib/payments";
import { computePerPlayer, computeTotalCost, formatLei } from "@/lib/pricing";
import {
  monthKeyFromDate,
  monthLabel,
  setSubscription,
  subscribeToMonthSubscriptions,
  type SubscriptionMap,
} from "@/lib/subscriptions";
import type { PaymentModel } from "@/lib/types";

interface MembersGroupProps {
  /** Currently viewed occurrence/event id (per-game payments live here). */
  eventId: string;
  /** Group identity: series roster or standalone-event roster. */
  groupId: string;
  groupType: GroupType;
  /** Series/event owner — used to scope removal in Firestore rules. */
  ownerId: string;
  eventDate?: string;
  pricePerHour?: number;
  durationMinutes?: number;
  paymentModel?: PaymentModel;
  canManage?: boolean;
}

function MemberAvatar({
  name,
  photoURL,
}: {
  name: string;
  photoURL: string | null;
}) {
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL || "/placeholder.svg"}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function MembersGroup({
  eventId,
  groupId,
  groupType,
  ownerId,
  eventDate,
  pricePerHour,
  durationMinutes,
  paymentModel = "per_game",
  canManage = false,
}: MembersGroupProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Record<string, "paid" | "unpaid">>(
    {}
  );
  const [subscriptions, setSubscriptions] = useState<SubscriptionMap>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const monthKey = eventDate ? monthKeyFromDate(eventDate) : "";

  // Roster (gated on auth so the listener doesn't fire before the token attaches).
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToGroupMembers(groupId, setMembers);
    return () => unsubscribe();
  }, [groupId, user]);

  // Per-game payment status from the event document.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      doc(db, "events", eventId),
      (snap) => {
        const data = snap.data();
        setPayments(
          (data?.payments as Record<string, "paid" | "unpaid">) ?? {}
        );
      },
      () => setPayments({})
    );
    return () => unsubscribe();
  }, [eventId, user]);

  // Monthly subscriptions for the event's month.
  useEffect(() => {
    if (!user || !monthKey) return;
    const unsubscribe = subscribeToMonthSubscriptions(monthKey, setSubscriptions);
    return () => unsubscribe();
  }, [monthKey, user]);

  const isMember = Boolean(user && members.some((m) => m.userId === user.uid));

  const totalCost = computeTotalCost(pricePerHour, durationMinutes);
  // Per-game cost is split among members who aren't covered by a subscription.
  const payers = members.filter((m) => !subscriptions[m.userId]);
  const perPlayer = computePerPlayer(totalCost, payers.length);

  async function handleJoin() {
    if (!user) return;
    setJoining(true);
    try {
      await joinGroup({
        groupId,
        groupType,
        ownerId,
        userId: user.uid,
        userName: user.displayName ?? user.email ?? "Membru",
        userPhoto: user.photoURL,
      });
    } finally {
      setJoining(false);
    }
  }

  async function handleRemove(userId: string) {
    setBusyUserId(userId);
    try {
      await removeMember(groupId, userId);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleTogglePaid(userId: string, nextPaid: boolean) {
    setBusyUserId(userId);
    try {
      await setPaymentStatus(eventId, payments, userId, nextPaid);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleSubscription(
    userId: string,
    userName: string,
    subscribed: boolean
  ) {
    if (!user || !monthKey) return;
    setBusyUserId(userId);
    try {
      await setSubscription(userId, monthKey, subscribed, {
        createdBy: user.uid,
        userName,
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (authLoading) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Se încarcă...</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">
          Grup
        </h2>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-muted-foreground">
            Conectează-te cu Google pentru a intra în grup.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
          >
            Conectează-te cu Google
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Grup ({members.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted active:scale-[0.98]"
          >
            {copied ? "Link copiat!" : "Copiază link grup"}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20 active:scale-[0.98]"
            >
              Adaugă membri
            </button>
          )}
          {!isMember && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60"
            >
              {joining ? "Se intră..." : "Intră în grup"}
            </button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <MemberPicker
          groupId={groupId}
          groupType={groupType}
          ownerId={ownerId}
          existingUserIds={new Set(members.map((m) => m.userId))}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {paymentModel === "monthly"
            ? `Plată: abonament lunar${
                monthKey ? ` · ${monthLabel(monthKey)}` : ""
              }`
            : "Plată: per joc"}
        </p>

        {members.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Niciun membru încă. Distribuie linkul ca jucătorii să intre în grup.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60 border-t border-border/60">
            {members.map((member) => {
              const subscribed = Boolean(subscriptions[member.userId]);
              const paid = isPaid(payments, member.userId);
              const busy = busyUserId === member.userId;
              const isSelf = member.userId === user.uid;
              return (
                <li
                  key={member.userId}
                  className="flex items-center gap-3 py-3"
                >
                  <MemberAvatar
                    name={member.userName}
                    photoURL={member.userPhoto}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {member.userName}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (tu)
                      </span>
                    )}
                  </span>

                  {/* Payment status — always visible next to each member. */}
                  {paymentModel === "monthly" ? (
                    canManage && monthKey ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleToggleSubscription(
                            member.userId,
                            member.userName,
                            !subscribed
                          )
                        }
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                          subscribed
                            ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                            : "border border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {subscribed ? "Abonat" : "Neabonat"}
                      </button>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          subscribed
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {subscribed ? "Abonat" : "Neabonat"}
                      </span>
                    )
                  ) : subscribed ? (
                    <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                      Abonament
                    </span>
                  ) : canManage ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleTogglePaid(member.userId, !paid)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                        paid
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {paid && perPlayer > 0
                        ? `Plătit · ${formatLei(perPlayer)}`
                        : paid
                          ? "Plătit"
                          : "Neplătit"}
                    </button>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        paid
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {paid
                        ? "Plătit"
                        : perPlayer > 0
                          ? formatLei(perPlayer)
                          : "Neplătit"}
                    </span>
                  )}

                  {/* Removal: owner/admin can remove anyone; members can leave. */}
                  {(canManage || isSelf) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemove(member.userId)}
                      aria-label={
                        isSelf
                          ? "Ieși din grup"
                          : `Elimină ${member.userName} din grup`
                      }
                      title={isSelf ? "Ieși din grup" : "Elimină din grup"}
                      className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
                    >
                      {isSelf ? "Ieși" : "Elimină"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {canManage
            ? "Poți elimina membri și marca plata fiecăruia. Plata rămâne vizibilă lângă fiecare membru."
            : "Plata fiecărui membru e gestionată de organizator."}
        </p>
      </div>
    </section>
  );
}
