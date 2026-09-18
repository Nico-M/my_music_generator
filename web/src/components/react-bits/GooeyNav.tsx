import React, { useRef, useEffect, useState } from 'react';

export interface GooeyNavItem {
  id?: string;
  number?: string;
  label: string;
  href?: string;
}

export interface GooeyNavProps {
  items: GooeyNavItem[];
  activeIndex?: number;
  initialActiveIndex?: number;
  onSelect?: (index: number) => void;
  animationTime?: number;
  particleCount?: number;
  particleDistances?: [number, number];
  particleR?: number;
  timeVariance?: number;
  colors?: string[];
  className?: string;
}

export const GooeyNav: React.FC<GooeyNavProps> = ({
  items,
  activeIndex: controlledActiveIndex,
  initialActiveIndex = 0,
  onSelect,
  animationTime = 500,
  particleCount = 14,
  particleDistances = [70, 8],
  particleR = 80,
  timeVariance = 240,
  colors = ['#6366f1', '#818cf8', '#a855f7', '#38bdf8', '#4f46e5'],
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLSpanElement>(null);
  const [internalActive, setInternalActive] = useState<number>(initialActiveIndex);
  const isMountedRef = useRef(false);

  const activeIndex = controlledActiveIndex !== undefined ? controlledActiveIndex : internalActive;

  const noise = (n = 1) => n / 2 - Math.random() * n;

  const getXY = (distance: number, pointIndex: number, totalPoints: number): [number, number] => {
    const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  };

  const createParticle = (i: number, t: number, d: [number, number], r: number) => {
    const rotate = noise(r / 10);
    return {
      start: getXY(d[0], particleCount - i, particleCount),
      end: getXY(d[1] + noise(7), particleCount - i, particleCount),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
    };
  };

  const makeParticles = (element: HTMLElement) => {
    const d: [number, number] = particleDistances;
    const r = particleR;
    const bubbleTime = animationTime * 2 + timeVariance;
    element.style.setProperty('--time', `${bubbleTime}ms`);

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const p = createParticle(i, t, d, r);

      setTimeout(() => {
        const particle = document.createElement('span');
        const point = document.createElement('span');
        particle.classList.add('gooey-particle');
        particle.style.setProperty('--start-x', `${p.start[0]}px`);
        particle.style.setProperty('--start-y', `${p.start[1]}px`);
        particle.style.setProperty('--end-x', `${p.end[0]}px`);
        particle.style.setProperty('--end-y', `${p.end[1]}px`);
        particle.style.setProperty('--time', `${p.time}ms`);
        particle.style.setProperty('--scale', `${p.scale}`);
        particle.style.setProperty('--color', p.color);
        particle.style.setProperty('--rotate', `${p.rotate}deg`);

        point.classList.add('gooey-point');
        particle.appendChild(point);
        element.appendChild(particle);

        requestAnimationFrame(() => {
          element.classList.add('active');
        });

        setTimeout(() => {
          try {
            if (particle.parentElement === element) {
              element.removeChild(particle);
            }
          } catch {}
        }, t);
      }, 25);
    }
  };

  const updateEffectPosition = (element: HTMLElement) => {
    if (!containerRef.current || !filterRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pos = element.getBoundingClientRect();

    const styles = {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    };
    Object.assign(filterRef.current.style, styles);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    if (activeIndex === index) return;
    setInternalActive(index);
    onSelect?.(index);

    const liEl = e.currentTarget.parentElement as HTMLElement;
    if (liEl) {
      updateEffectPosition(liEl);
      if (filterRef.current) {
        const particles = filterRef.current.querySelectorAll('.gooey-particle');
        particles.forEach((p) => filterRef.current?.removeChild(p));
        makeParticles(filterRef.current);
      }
    }
  };

  // Sync with activeIndex changes (e.g. from parent scroll)
  useEffect(() => {
    if (!navRef.current || !containerRef.current) return;
    const itemsList = navRef.current.querySelectorAll('li');
    const activeLi = itemsList[activeIndex] as HTMLElement;

    if (activeLi) {
      updateEffectPosition(activeLi);

      if (isMountedRef.current && filterRef.current) {
        const particles = filterRef.current.querySelectorAll('.gooey-particle');
        particles.forEach((p) => filterRef.current?.removeChild(p));
        makeParticles(filterRef.current);
      }
    }

    if (!isMountedRef.current) {
      isMountedRef.current = true;
    }

    const resizeObserver = new ResizeObserver(() => {
      const currentLi = navRef.current?.querySelectorAll('li')[activeIndex] as HTMLElement;
      if (currentLi) {
        updateEffectPosition(currentLi);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  return (
    <>
      <style>{`
        .gooey-nav-container {
          position: relative;
        }
        .gooey-effect {
          position: absolute;
          left: 0;
          top: 0;
          width: 0;
          height: 0;
          opacity: 1;
          pointer-events: none;
          display: grid;
          place-items: center;
          z-index: 1;
          transition: left 0.38s cubic-bezier(0.2, 0.9, 0.3, 1), width 0.3s ease, height 0.3s ease;
        }
        .gooey-effect.filter {
          filter: blur(5px) contrast(60) blur(0);
          mix-blend-mode: lighten;
        }
        .gooey-effect.filter::before {
          content: '';
          position: absolute;
          inset: -55px;
          z-index: -2;
          background: #000000;
        }
        .gooey-effect.filter::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border-radius: 9999px;
          box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
          transform: scale(1);
          opacity: 1;
          z-index: -1;
        }
        .gooey-particle,
        .gooey-point {
          display: block;
          opacity: 0;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          transform-origin: center;
        }
        .gooey-particle {
          --time: 4s;
          position: absolute;
          top: calc(50% - 7px);
          left: calc(50% - 7px);
          animation: gooey-particle calc(var(--time)) ease 1 -280ms;
        }
        .gooey-point {
          background: var(--color, #6366f1);
          opacity: 1;
          animation: gooey-point calc(var(--time)) ease 1 -280ms;
        }
        @keyframes gooey-particle {
          0% {
            transform: rotate(0deg) translate(calc(var(--start-x)), calc(var(--start-y)));
            opacity: 1;
            animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
          }
          70% {
            transform: rotate(calc(var(--rotate) * 0.5)) translate(calc(var(--end-x) * 1.2), calc(var(--end-y) * 1.2));
            opacity: 1;
            animation-timing-function: ease;
          }
          85% {
            transform: rotate(calc(var(--rotate) * 0.66)) translate(calc(var(--end-x)), calc(var(--end-y)));
            opacity: 1;
          }
          100% {
            transform: rotate(calc(var(--rotate) * 1.2)) translate(calc(var(--end-x) * 0.5), calc(var(--end-y) * 0.5));
            opacity: 1;
          }
        }
        @keyframes gooey-point {
          0% {
            transform: scale(0);
            opacity: 0;
            animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
          }
          25% {
            transform: scale(calc(var(--scale) * 0.3));
          }
          38% {
            opacity: 1;
          }
          65% {
            transform: scale(var(--scale));
            opacity: 1;
            animation-timing-function: ease;
          }
          85% {
            transform: scale(var(--scale));
            opacity: 1;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }
      `}</style>
      <div className={`gooey-nav-container ${className}`} ref={containerRef}>
        <nav className="flex relative" style={{ transform: 'translate3d(0,0,0.01px)' }}>
          <ul
            ref={navRef}
            className="flex items-center gap-1 list-none p-1 m-0 relative z-[3] rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
          >
            {items.map((item, index) => {
              const isActive = activeIndex === index;
              return (
                <li key={item.id ?? index} className="relative z-[3]">
                  <button
                    type="button"
                    onClick={(e) => handleClick(e, index)}
                    className={`px-3.5 py-1 rounded-full transition-all duration-300 cursor-pointer flex items-center gap-1.5 text-xs font-medium outline-none ${
                      isActive
                        ? 'text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.number && (
                      <span
                        className={`text-[10px] font-mono transition-opacity ${
                          isActive ? 'text-white/80' : 'opacity-60'
                        }`}
                      >
                        {item.number}
                      </span>
                    )}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <span className="gooey-effect filter" ref={filterRef} />
      </div>
    </>
  );
};

export default GooeyNav;
