import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile/tablet breakpoints, touch capabilities, and orientation
 */
export function useMobile() {
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

    useEffect(() => {
        const mobileMql = window.matchMedia('(max-width: 767px)');
        const tabletMql = window.matchMedia('(max-width: 1024px)');
        const landscapeMql = window.matchMedia('(orientation: landscape)');

        const updateMatch = () => {
            setIsMobile(mobileMql.matches);
            setIsTablet(tabletMql.matches);
            setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
            setIsLandscape(landscapeMql.matches);
            setScreenWidth(window.innerWidth);
        };

        updateMatch();

        mobileMql.addEventListener('change', updateMatch);
        tabletMql.addEventListener('change', updateMatch);
        landscapeMql.addEventListener('change', updateMatch);
        window.addEventListener('resize', updateMatch);

        return () => {
            mobileMql.removeEventListener('change', updateMatch);
            tabletMql.removeEventListener('change', updateMatch);
            landscapeMql.removeEventListener('change', updateMatch);
            window.removeEventListener('resize', updateMatch);
        };
    }, []);

    return { isMobile, isTablet, isTouchDevice, isLandscape, screenWidth };
}
