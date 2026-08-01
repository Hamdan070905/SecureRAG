import { motion } from "framer-motion";
import React from "react";

interface TextEffectProps {
  children: string;
  preset?: "fade-in-blur" | "fade";
  speedReveal?: number;
  speedSegment?: number;
  className?: string;
}

export function TextEffect({
  children,
  preset = "fade-in-blur",
  speedReveal = 1.1,
  speedSegment = 0.3,
  className,
}: TextEffectProps) {
  const words = children.split(" ");

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: (speedReveal / words.length) * speedSegment,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      filter: preset === "fade-in-blur" ? "blur(4px)" : "none",
      y: 2,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        duration: speedReveal / 2,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.span
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: "inline-block" }}
    >
      {words.map((word, idx) => (
        <motion.span
          key={idx}
          variants={wordVariants}
          style={{ display: "inline-block", marginRight: "0.25em" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
