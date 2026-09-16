"use client";

import { useState } from "react";
import styles from "./landing.module.css";

export interface FaqEntry {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqEntry[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className={styles.faq}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-answer-${i}`;
        return (
          <div key={item.q} className={styles.faqItem}>
            <button
              type="button"
              className={styles.faqButton}
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              {item.q}
              <span className={styles.faqSign} aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div
              id={id}
              className={`${styles.faqBody} ${isOpen ? styles.faqOpen : ""}`}
              inert={!isOpen}
            >
              <div className={styles.faqInner}>
                <p className={styles.faqAnswer}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
