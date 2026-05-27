"use client";

import { useEffect } from "react";
import { createDevLines, type DevLinesOptions } from "./index";

export interface DevLinesProps extends DevLinesOptions {}

/**
 * Mounts the dev-lines overlay for the lifetime of this component.
 * Render it once, gated behind a dev check:
 *
 *   {process.env.NODE_ENV === "development" && <DevLines contentWidth={416} />}
 */
export function DevLines(props: DevLinesProps = {}) {
  // re-create when options change; teardown is total so this is cheap.
  const key = JSON.stringify(props);
  useEffect(() => {
    const controller = createDevLines(props);
    return () => controller.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export default DevLines;
