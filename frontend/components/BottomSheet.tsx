"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";

interface BottomSheetProps {
  children: React.ReactNode;
  label?: string;
}

export default function BottomSheet({ children, label = "评分面板" }: BottomSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button — fixed bottom */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-1.5 px-4 py-2.5 rounded-full
          bg-[var(--bg-1)] border border-border shadow-card-hover
          text-xs font-semibold text-text-secondary hover:text-text-primary
          transition-all cursor-pointer lg:hidden"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        {label}
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto
                bg-[var(--bg-0)] border-t border-border rounded-t-2xl shadow-2xl lg:hidden"
            >
              {/* Drag handle */}
              <div className="sticky top-0 flex justify-center py-3 bg-[var(--bg-0)] rounded-t-2xl">
                <div className="w-10 h-1 rounded-full bg-[var(--bg-3)]" />
              </div>
              <div className="px-4 pb-6">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
