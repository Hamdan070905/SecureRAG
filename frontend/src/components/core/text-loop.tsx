import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect } from "react";

interface TextLoopProps {
  children: React.ReactNode[];
  className?: string;
  interval?: number;
}

export function TextLoop({
  children,
  className,
  interval = 3000,
}: TextLoopProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % children.length);
    }, interval);
    return () => clearInterval(timer);
  }, [children.length, interval]);

  return (
    <div className={`relative inline-block overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {children[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
