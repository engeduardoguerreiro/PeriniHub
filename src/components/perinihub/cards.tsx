import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FeatureCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function FeatureCard({ title, description, icon: Icon }: FeatureCardProps) {
  return (
    <Card className="group relative h-full overflow-hidden border-zinc-200/80 bg-white/78 shadow-sm backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:border-red-200/80 hover:shadow-2xl hover:shadow-zinc-900/10">
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden="true"
      />
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-zinc-950 text-white transition-all duration-500 group-hover:scale-105 group-hover:bg-red-600 group-hover:shadow-lg group-hover:shadow-red-600/25">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="font-display text-xl font-extrabold tracking-tight text-zinc-950">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-zinc-600">{description}</p>
      </CardContent>
    </Card>
  );
}

type EcosystemCardProps = {
  name: string;
  description: string;
  status: string;
  action: string;
  icon: LucideIcon;
};

export function EcosystemCard({
  name,
  description,
  status,
  action,
  icon: Icon,
}: EcosystemCardProps) {
  const active = status === "Ativo" || status === "Em operação";

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border-zinc-200/80 bg-white/82 shadow-sm backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-zinc-900/10">
      <CardHeader className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-900 transition-all duration-500 group-hover:scale-105 group-hover:border-red-200 group-hover:bg-red-50 group-hover:text-red-600">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <Badge
            variant={active ? "default" : "secondary"}
            className={
              active
                ? "bg-red-600 text-white hover:bg-red-600"
                : "bg-zinc-100 text-zinc-700"
            }
          >
            {status}
          </Badge>
        </div>
        <CardTitle className="font-display text-2xl font-extrabold tracking-[-0.03em] text-zinc-950">
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="flex-1 text-sm leading-7 text-zinc-600">{description}</p>
        <Button
          asChild
          variant={active ? "default" : "outline"}
          className={`mt-8 rounded-md ${
            active ? "bg-zinc-900 hover:bg-red-700" : ""
          }`}
        >
          <a href={active ? "#contato" : "#ecossistema"}>{action}</a>
        </Button>
      </CardContent>
    </Card>
  );
}

type ClientCardProps = {
  name: string;
  segment: string;
  description: string;
  icon: LucideIcon;
};

export function ClientCard({ name, segment, description, icon: Icon }: ClientCardProps) {
  return (
    <Card className="group h-full border-zinc-200/80 bg-white/82 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-zinc-900/6">
      <CardHeader className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-900 group-hover:border-red-200 group-hover:text-red-600">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
            {segment}
          </Badge>
        </div>
        <CardTitle className="font-display text-2xl font-extrabold tracking-[-0.03em] text-zinc-950">
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-zinc-600">{description}</p>
      </CardContent>
    </Card>
  );
}

type ProcessStepProps = {
  title: string;
  description: string;
  index: number;
  tone?: "light" | "dark";
};

export function ProcessStep({
  title,
  description,
  index,
  tone = "light",
}: ProcessStepProps) {
  return (
    <div className="relative flex gap-4 lg:block">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ring-8 ${
          tone === "dark"
            ? "bg-white text-zinc-950 ring-zinc-950"
            : "bg-zinc-950 text-white ring-white"
        }`}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="pb-8 lg:pt-6">
        <h3
          className={`font-display text-lg font-extrabold tracking-tight ${
            tone === "dark" ? "text-white" : "text-zinc-950"
          }`}
        >
          {title}
        </h3>
        <p
          className={`mt-2 text-sm leading-7 ${
            tone === "dark" ? "text-zinc-300" : "text-zinc-600"
          }`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
