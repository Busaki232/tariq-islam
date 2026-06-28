import { useState, useEffect } from 'react';

export const useRealTimeClock = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    // Update immediately
    setCurrentTime(new Date());

    return () => clearInterval(timer);
  }, []);

  return currentTime;
};