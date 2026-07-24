"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { MapPin, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AuthDialog } from "@/components/auth/auth-dialog";
import {
  searchBusinessesForClaimAction,
  submitBusinessClaimAndRedirect,
} from "@/lib/business-portal/actions";
import type { BusinessResult } from "@/lib/schemas/business";
import type { BusinessClaimantRole } from "@/types/database";
import type { SessionUser } from "@/components/user-menu";

const CLAIMANT_ROLES: { value: BusinessClaimantRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const VERIFICATION_METHODS: {
  value: "self_attestation" | "email_domain" | "phone_otp" | "document";
  label: string;
  hint: string;
}[] = [
  {
    value: "self_attestation",
    label: "Self-attestation",
    hint: "I confirm I represent this business (reviewed by our team).",
  },
  {
    value: "email_domain",
    label: "Business email domain",
    hint: "Use an email matching the business website domain when possible.",
  },
  {
    value: "phone_otp",
    label: "Phone on listing",
    hint: "We’ll verify against the phone listed for this business (coming soon).",
  },
  {
    value: "document",
    label: "Supporting notes / document",
    hint: "Add verification details in notes (registration, utility bill, etc.).",
  },
];

type Step = "search" | "form";

export function ClaimWizard({
  citySlug,
  cityName,
  user,
}: {
  citySlug: string;
  cityName: string;
  user: SessionUser | null;
}) {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [selected, setSelected] = useState<BusinessResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [authOpen, setAuthOpen] = useState(!user);

  const [claimantName, setClaimantName] = useState(user?.name ?? "");
  const [claimantEmail, setClaimantEmail] = useState(user?.email ?? "");
  const [claimantPhone, setClaimantPhone] = useState("");
  const [claimantRole, setClaimantRole] =
    useState<BusinessClaimantRole>("owner");
  const [verificationMethod, setVerificationMethod] = useState<
    "self_attestation" | "email_domain" | "phone_otp" | "document"
  >("self_attestation");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const claimPath = useMemo(
    () => `/${citySlug}/business/claim`,
    [citySlug],
  );

  function ensureAuth(): boolean {
    if (user) return true;
    setAuthOpen(true);
    toast.message("Sign in to claim a business");
    return false;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!ensureAuth()) return;
    const q = query.trim();
    if (!q) return;

    startSearch(async () => {
      const result = await searchBusinessesForClaimAction({
        query: q,
        citySlug,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResults(result.data);
      if (result.data.length === 0) {
        toast.message("No businesses found. Try a different name.");
      }
    });
  }

  function selectBusiness(business: BusinessResult) {
    if (!ensureAuth()) return;
    setSelected(business);
    setStep("form");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ensureAuth() || !selected) return;

    startSubmit(async () => {
      const result = await submitBusinessClaimAndRedirect({
        businessId: selected.id,
        citySlug,
        claimantName,
        claimantEmail,
        claimantPhone,
        claimantRole,
        verificationMethod,
        notes,
        confirmed,
      });
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        next={claimPath}
        title="Sign in to claim your business"
        description="Verify your account to submit a claim for review."
      />

      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Business Portal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Claim your business
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Search for your listing in {cityName}, submit a claim, and unlock
            the Business Portal once approved.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={step === "search" ? "default" : "secondary"}>
            1. Search
          </Badge>
          <span aria-hidden>→</span>
          <Badge variant={step === "form" ? "default" : "outline"}>
            2. Claim
          </Badge>
          <span aria-hidden>→</span>
          <Badge variant="outline">3. Review</Badge>
        </div>

        {step === "search" ? (
          <Card>
            <CardHeader>
              <CardTitle>Find your business in {cityName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`e.g. Mozambik ${cityName}`}
                    className="pl-8"
                    aria-label="Search businesses"
                  />
                </div>
                <Button type="submit" disabled={searching || !query.trim()}>
                  {searching ? "Searching…" : "Search"}
                </Button>
              </form>

              <div className="space-y-3">
                {results.map((business) => (
                  <ClaimSearchResult
                    key={business.id}
                    business={business}
                    onClaim={() => selectBusiness(business)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === "form" && selected ? (
          <Card>
            <CardHeader>
              <CardTitle>Claim {selected.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">{selected.name}</p>
                  {selected.address ? (
                    <p className="text-muted-foreground">{selected.address}</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0"
                    onClick={() => {
                      setStep("search");
                      setSelected(null);
                    }}
                  >
                    Choose a different business
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claimantName">Your name</Label>
                    <Input
                      id="claimantName"
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claimantEmail">Email</Label>
                    <Input
                      id="claimantEmail"
                      type="email"
                      value={claimantEmail}
                      onChange={(e) => setClaimantEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claimantPhone">Phone</Label>
                    <Input
                      id="claimantPhone"
                      type="tel"
                      value={claimantPhone}
                      onChange={(e) => setClaimantPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claimantRole">Your role</Label>
                    <select
                      id="claimantRole"
                      value={claimantRole}
                      onChange={(e) =>
                        setClaimantRole(e.target.value as BusinessClaimantRole)
                      }
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {CLAIMANT_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verificationMethod">
                    How should we verify you?
                  </Label>
                  <select
                    id="verificationMethod"
                    value={verificationMethod}
                    onChange={(e) =>
                      setVerificationMethod(
                        e.target.value as typeof verificationMethod,
                      )
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {VERIFICATION_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {
                      VERIFICATION_METHODS.find(
                        (m) => m.value === verificationMethod,
                      )?.hint
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything that helps us verify your claim"
                  />
                </div>

                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={confirmed}
                    onCheckedChange={(value) => setConfirmed(value === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I confirm I represent this business and am authorized to
                    claim it on Ask Ballito.
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={submitting || !confirmed}
                  className="w-full sm:w-auto"
                >
                  {submitting ? "Submitting…" : "Submit claim"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function ClaimSearchResult({
  business,
  onClaim,
}: {
  business: BusinessResult;
  onClaim: () => void;
}) {
  const photo = business.photos?.[0];

  return (
    <div className="flex gap-3 rounded-xl border p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {photo?.url ? (
          <Image
            src={photo.url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium">{business.name}</p>
        {business.category ? (
          <p className="text-xs text-muted-foreground">{business.category}</p>
        ) : null}
        {business.address ? (
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{business.address}</span>
          </p>
        ) : null}
        {business.rating != null ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3 fill-current" />
            {business.rating.toFixed(1)}
            {business.ratingCount != null
              ? ` (${business.ratingCount})`
              : null}
          </p>
        ) : null}
      </div>
      <div className="flex items-center">
        <Button type="button" size="sm" onClick={onClaim}>
          Claim this Business
        </Button>
      </div>
    </div>
  );
}
