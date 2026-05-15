"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Cable,
  DollarSign,
  History,
  Home,
  MessageCircle,
  Package,
  RefreshCw,
  RotateCcw,
  Settings,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/app",
    label: "오늘 처리",
    icon: Home,
    isActive: (pathname: string) => pathname === "/app",
  },
  {
    href: "/app/orders",
    label: "주문",
    icon: ShoppingCart,
    isActive: (pathname: string) => pathname.startsWith("/app/orders"),
  },
  {
    href: "/app/cs",
    label: "CS",
    icon: MessageCircle,
    isActive: (pathname: string) => pathname.startsWith("/app/cs"),
  },
  {
    href: "/app/claims",
    label: "취소·반품",
    icon: RotateCcw,
    isActive: (pathname: string) => pathname.startsWith("/app/claims"),
  },
  {
    href: "/app/products",
    label: "상품·재고",
    shortLabel: "상품",
    icon: Package,
    isActive: (pathname: string) => pathname.startsWith("/app/products"),
  },
  {
    href: "/app/margins",
    label: "가격·마진",
    icon: DollarSign,
    isActive: (pathname: string) => pathname.startsWith("/app/margins"),
  },
  {
    href: "/app/integrations",
    label: "공급사·마켓",
    icon: Cable,
    isActive: (pathname: string) => pathname.startsWith("/app/integrations"),
  },
  {
    href: "/app/history",
    label: "작업 이력",
    icon: History,
    isActive: (pathname: string) => pathname.startsWith("/app/history"),
  },
  {
    href: "/app/onboarding",
    label: "온보딩",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith("/app/onboarding"),
  },
];

export function AppSidebar({
  tenantName,
  roleLabel,
}: {
  tenantName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <div className="app-brand-mark" aria-hidden="true">
          CO
        </div>
        <div>
          <strong>운영 모니터링</strong>
          <span>{tenantName}</span>
        </div>
      </div>

      <nav className="app-nav" aria-label="주요 메뉴">
        {navItems.map(({ href, label, shortLabel, icon: Icon, isActive }) => {
          const active = isActive(pathname);

          return (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`app-nav-item ${active ? "is-active" : ""}`}
                  data-motion="nav-item"
                  href={href}
                >
                  {active ? (
                    <motion.span
                      aria-hidden="true"
                      className="app-nav-active-indicator"
                      layoutId="app-nav-active-indicator"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                    />
                  ) : null}
                  <Icon aria-hidden="true" size={16} strokeWidth={2} />
                  <span className="app-nav-label">{label}</span>
                  {shortLabel ? <span className="app-nav-label-short">{shortLabel}</span> : null}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <div>
          <span>권한</span>
          <strong>{roleLabel}</strong>
        </div>
        <div>
          <span>최근 동기화</span>
          <strong>3분 전</strong>
        </div>
        <Button className="app-sync-button" type="button" size="sm" variant="outline">
          <RefreshCw aria-hidden="true" size={14} strokeWidth={2} />
          동기화
        </Button>
      </div>
    </aside>
  );
}
