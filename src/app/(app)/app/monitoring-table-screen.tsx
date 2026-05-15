"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MonitoringScreen } from "./monitoring-data";
import { ActionLink, Pill, toneClass } from "./monitoring-primitives";

const pageMotion = {
  initial: { y: 10 },
  animate: { y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.045,
    },
  },
} as const;

const riseIn = {
  hidden: { y: 8 },
  show: {
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

export function MonitoringTableScreen({ screen }: { screen: MonitoringScreen }) {
  const hasMobileReference = screen.referenceId === "DkLfQ";

  return (
    <>
      <motion.section
        {...pageMotion}
        className={`ops-screen ${hasMobileReference ? "has-mobile-reference" : ""}`}
        data-motion="page"
        data-reference={screen.referenceId}
      >
        <header className="ops-page-header">
          <div>
            <p className="ops-eyebrow">{screen.eyebrow}</p>
            <h1>{screen.title}</h1>
            <p className="ops-description">{screen.description}</p>
          </div>
          <Button type="button" className="ops-primary-button" size="lg">
            {screen.cta}
          </Button>
        </header>

        <motion.section
          aria-label={screen.sidebarTitle}
          className="ops-insights"
          data-motion="staggered-insights"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          {screen.sideItems.map((item) => {
            const className = `ops-insight ${toneClass[item.tone]} ${item.active ? "is-active" : ""}`;
            const content = (
              <>
                <span>{item.label}</span>
                <strong>{item.meta}</strong>
              </>
            );

            if (item.href) {
              return (
                <motion.div key={item.label} variants={riseIn} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                  <Card className={className} size="sm">
                    <Link className="ops-insight-link" href={item.href}>
                      {content}
                    </Link>
                  </Card>
                </motion.div>
              );
            }

            return (
              <motion.div key={item.label} variants={riseIn} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                <Card className={className} size="sm">
                  {content}
                </Card>
              </motion.div>
            );
          })}
        </motion.section>

        <Card className="ops-card" data-motion="table-card">
          <div className="ops-filterbar">
            <label className="ops-search">
              <span>검색</span>
              <Input type="search" placeholder={screen.searchPlaceholder} />
            </label>
            <Button type="button" className="ops-filter-button" size="sm" variant="outline">
              {screen.filterLabel}
            </Button>
          </div>

          <CardContent className="ops-table-shell">
            <Table className="ops-table" aria-label={`${screen.title} 목록`}>
              <TableHeader>
                <TableRow className="ops-table-row ops-table-head">
                  {screen.columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {screen.rows.map((row, index) => (
                  <motion.tr
                    className="ops-table-row"
                    data-motion="table-row"
                    initial={{ y: 4 }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.05 + index * 0.035, duration: 0.22 }}
                    whileHover={{ backgroundColor: "color-mix(in oklch, var(--muted) 62%, transparent)" }}
                    key={`${row.work}-${row.detail}`}
                  >
                    <TableCell>
                      <strong>{row.work}</strong>
                      <span>{row.workMeta}</span>
                    </TableCell>
                    <TableCell>
                      <strong>{row.detail}</strong>
                      <span>{row.detailMeta}</span>
                    </TableCell>
                    <TableCell>
                      <Pill tone={row.statusTone}>{row.status}</Pill>
                    </TableCell>
                    <TableCell className={row.dueTone ? `ops-due ${toneClass[row.dueTone]}` : "ops-due"}>
                      {row.due}
                    </TableCell>
                    <TableCell>
                      <ActionLink row={row} />
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.section>
      {hasMobileReference ? <MobileTodayScreen screen={screen} /> : null}
    </>
  );
}

function MobileTodayScreen({ screen }: { screen: MonitoringScreen }) {
  return (
    <motion.section {...pageMotion} className="mobile-today-screen" data-motion="mobile-page" data-reference="GlQOZ">
      <header className="mobile-today-header">
        <div>
          <p className="ops-eyebrow">Demo Seller</p>
          <h1>오늘 처리</h1>
          <p>긴급한 승인과 CS부터 처리합니다.</p>
        </div>
        <Button type="button" className="ops-primary-button" size="sm">
          새로고침
        </Button>
      </header>

      <motion.section
        aria-label="오늘 처리 요약"
        className="mobile-today-cards"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {screen.sideItems.map((item) => (
          <motion.article
            className={`mobile-today-card ${toneClass[item.tone]} ${item.active ? "is-active" : ""}`}
            key={item.label}
            variants={riseIn}
            whileTap={{ scale: 0.985 }}
          >
            <strong>{item.label === "CS 긴급" ? "CS 위험" : item.label.replace("발주·송장", "주문")}</strong>
            <span>{item.meta}</span>
          </motion.article>
        ))}
      </motion.section>

      <div className="ops-filterbar mobile-filterbar">
        <label className="ops-search">
          <span>검색</span>
          <Input type="search" placeholder="검색" />
        </label>
        <Button type="button" className="ops-filter-button" size="sm" variant="outline">
          긴급
        </Button>
      </div>

      <section className="mobile-work-list" aria-label="모바일 오늘 처리 목록">
        <div className="mobile-work-head">
          <span>작업</span>
          <span>내용</span>
        </div>
        {screen.rows.map((row) => (
          <article className="mobile-work-row" key={`${row.work}-${row.detail}`}>
            <div>
              <strong>{row.work}</strong>
              <span>{row.due}</span>
            </div>
            <div>
              <strong>{row.detail}</strong>
              <span>{row.status}</span>
            </div>
          </article>
        ))}
      </section>
    </motion.section>
  );
}
