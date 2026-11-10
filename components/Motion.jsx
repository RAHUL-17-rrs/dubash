'use client';
// Scroll reveals for the landing page. Elements marked data-reveal start hidden only once this has run
// (html.motion), so the page is complete without JavaScript and for anyone who asked for reduced motion.
// Only transform and opacity change, so nothing shifts layout.
import { useEffect } from 'react';

export default function Motion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    const els = [...document.querySelectorAll('[data-reveal]')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );
    root.classList.add('motion');
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove('motion');
    };
  }, []);
  return null;
}
