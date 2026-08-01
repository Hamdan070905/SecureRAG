"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "../../lib/utils";

interface PixelCanvasProps extends React.HTMLAttributes<HTMLDivElement> {
    gap?: number;
    speed?: number;
    colors?: string[];
    noFocus?: boolean;
    variant?: "default" | "trail" | "glow";
}

interface Pixel {
    x: number;
    y: number;
    size: number;
    intensity: number;
    targetIntensity: number;
    colorPhase: number;
    breathPhase: number;
    baseIntensity: number;
}

function lerpColor(color1: string, color2: string, t: number): string {
    const parse = (hex: string) => {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? { r: parseInt(r[1]!, 16), g: parseInt(r[2]!, 16), b: parseInt(r[3]!, 16) } : null;
    };
    const c1 = parse(color1);
    const c2 = parse(color2);
    if (!c1 || !c2) return color1;
    return `rgb(${Math.round(c1.r + (c2.r - c1.r) * t)},${Math.round(c1.g + (c2.g - c1.g) * t)},${Math.round(c1.b + (c2.b - c1.b) * t)})`;
}

export function PixelCanvas({
    className,
    gap = 5,
    speed = 0.018,
    colors = ["#22d3ee", "#38bdf8", "#818cf8", "#a78bfa", "#67e8f9"],
    noFocus = false,
    variant = "glow",
    ...props
}: PixelCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pixelsRef = useRef<Pixel[][]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const timeRef = useRef<number>(0);

    const getColor = useCallback((intensity: number, phase: number): string => {
        if (colors.length === 0) return "#22d3ee";
        if (colors.length === 1) return colors[0]!;
        const t = (phase + intensity * 0.4) % 1;
        const idx = Math.floor(t * (colors.length - 1));
        const next = Math.min(idx + 1, colors.length - 1);
        const local = (t * (colors.length - 1)) % 1;
        return lerpColor(colors[idx]!, colors[next]!, local);
    }, [colors]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;

        let cols = 0;
        let rows = 0;
        const pixelSize = Math.max(gap, 3);

        const initPixels = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            ctx.scale(dpr, dpr);

            cols = Math.ceil(rect.width / pixelSize);
            rows = Math.ceil(rect.height / pixelSize);

            const newPixels: Pixel[][] = [];
            for (let i = 0; i < cols; i++) {
                const row: Pixel[] = [];
                for (let j = 0; j < rows; j++) {
                    const existing = pixelsRef.current[i]?.[j];
                    // Sparse base ambient: ~25% of pixels have ambient glow
                    const isAmbient = Math.random() < 0.25;
                    row.push({
                        x: i * pixelSize,
                        y: j * pixelSize,
                        size: pixelSize - 1,
                        intensity: existing?.intensity ?? 0,
                        targetIntensity: 0,
                        colorPhase: Math.random(),
                        breathPhase: Math.random() * Math.PI * 2,
                        baseIntensity: isAmbient ? 0.04 + Math.random() * 0.06 : 0,
                    });
                }
                newPixels.push(row);
            }
            pixelsRef.current = newPixels;
        };

        const draw = (timestamp: number) => {
            const deltaTime = Math.min(timestamp - lastTimeRef.current, 50);
            lastTimeRef.current = timestamp;
            timeRef.current += deltaTime * 0.001;
            const t = timeRef.current;

            const rect = container.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);

            const { x: mouseX, y: mouseY } = mouseRef.current;
            const pixels = pixelsRef.current;

            // Center glow: softer radial behind chat area
            const cx = rect.width * 0.5;
            const cy = rect.height * 0.45;
            const maxR = Math.max(rect.width, rect.height) * 0.55;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
            grad.addColorStop(0, "rgba(56,189,248,0.028)");
            grad.addColorStop(0.5, "rgba(129,140,248,0.012)");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, rect.width, rect.height);

            // Interaction radius — large for dramatic cursor effect
            const radius = 160;

            for (let i = 0; i < cols; i++) {
                const col = pixels[i];
                if (!col) continue;

                for (let j = 0; j < rows; j++) {
                    const pixel = col[j];
                    if (!pixel) continue;

                    const centerX = pixel.x + pixel.size / 2;
                    const centerY = pixel.y + pixel.size / 2;

                    // Edge fade factor: pixels near edges are dimmer
                    const edgeX = Math.min(centerX / rect.width, 1 - centerX / rect.width);
                    const edgeY = Math.min(centerY / rect.height, 1 - centerY / rect.height);
                    const edgeFade = Math.min(edgeX * 6, 1) * Math.min(edgeY * 6, 1);

                    // Mouse proximity
                    const dx = mouseX - centerX;
                    const dy = mouseY - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const mouseTarget = dist < radius
                        ? Math.pow(1 - dist / radius, 1.4) * edgeFade
                        : 0;

                    // Breathing ambient
                    const breath = pixel.baseIntensity > 0
                        ? pixel.baseIntensity * (0.5 + 0.5 * Math.sin(t * 0.8 + pixel.breathPhase)) * edgeFade
                        : 0;

                    pixel.targetIntensity = Math.max(mouseTarget, breath);

                    const lerpSpeed = pixel.targetIntensity > pixel.intensity ? 0.28 : speed;
                    pixel.intensity += (pixel.targetIntensity - pixel.intensity) * lerpSpeed;

                    // Slowly shift color phase
                    pixel.colorPhase = (pixel.colorPhase + 0.0008 * (deltaTime / 16)) % 1;

                    if (pixel.intensity > 0.008) {
                        const color = getColor(pixel.intensity, pixel.colorPhase);

                        // Outer glow pass
                        if (pixel.intensity > 0.15) {
                            const glowSize = pixel.size + 5;
                            const glowOff = (glowSize - pixel.size) / 2;
                            ctx.globalAlpha = pixel.intensity * 0.18;
                            ctx.fillStyle = color;
                            ctx.fillRect(pixel.x - glowOff, pixel.y - glowOff, glowSize, glowSize);
                        }

                        // Main pixel
                        ctx.globalAlpha = pixel.intensity * 0.95;
                        ctx.fillStyle = color;
                        ctx.fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
                    }
                }
            }

            ctx.globalAlpha = 1;
            animationRef.current = requestAnimationFrame(draw);
        };

        const onMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        const onMouseLeave = () => { mouseRef.current = { x: -1000, y: -1000 }; };
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0]!;
                const rect = canvas.getBoundingClientRect();
                mouseRef.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
            }
        };

        initPixels();
        lastTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(draw);

        window.addEventListener("resize", initPixels);
        if (!noFocus) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("touchmove", onTouchMove, { passive: true });
        }

        return () => {
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener("resize", initPixels);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("touchmove", onTouchMove);
        };
    }, [gap, speed, noFocus, variant, getColor]);

    return (
        <div
            ref={containerRef}
            className={cn("h-full w-full relative overflow-hidden", className)}
            {...props}
        >
            <canvas ref={canvasRef} className="block w-full h-full" style={{ willChange: 'transform' }} />
        </div>
    );
}
