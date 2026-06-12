import { useCallback, useRef } from 'react';
import * as THREE from 'three';

// Reimplements the math from three.js's removed DeviceOrientationControls:
// converts alpha/beta/gamma (deviceorientation) into a quaternion that can be
// applied to a camera, compensating for the screen's current rotation.
const ZEE = new THREE.Vector3(0, 0, 1);
const EULER = new THREE.Euler();
const SCREEN_TRANSFORM = new THREE.Quaternion();
// -PI/2 around the X axis — re-orients the world so "up" matches the device's
// natural portrait orientation instead of the sensor's reference frame.
const WORLD_TRANSFORM = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function getScreenOrientationAngle() {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return THREE.MathUtils.degToRad(screen.orientation.angle);
  }
  if (typeof window !== 'undefined' && typeof window.orientation === 'number') {
    return THREE.MathUtils.degToRad(window.orientation);
  }
  return 0;
}

// Provides device-orientation tracking for "magic window" style AR, where the
// camera rotation follows the phone's gyroscope instead of WebXR pose data.
export function useDeviceOrientation() {
  const handlerRef = useRef(null);

  // iOS 13+ requires this to be called from inside a user-gesture handler
  // with no prior `await`s, otherwise the permission prompt never appears.
  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') return 'granted';
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }, []);

  const start = useCallback((onOrientation) => {
    const handler = (event) => {
      const { alpha, beta, gamma } = event;
      if (alpha == null || beta == null || gamma == null) return;
      const quaternion = new THREE.Quaternion();
      EULER.set(
        THREE.MathUtils.degToRad(beta),
        THREE.MathUtils.degToRad(alpha),
        -THREE.MathUtils.degToRad(gamma),
        'YXZ'
      );
      quaternion.setFromEuler(EULER);
      quaternion.multiply(WORLD_TRANSFORM);
      quaternion.multiply(SCREEN_TRANSFORM.setFromAxisAngle(ZEE, -getScreenOrientationAngle()));
      onOrientation(quaternion);
    };
    window.addEventListener('deviceorientation', handler);
    handlerRef.current = handler;
  }, []);

  const stop = useCallback(() => {
    if (handlerRef.current) {
      window.removeEventListener('deviceorientation', handlerRef.current);
      handlerRef.current = null;
    }
  }, []);

  return { requestPermission, start, stop };
}
