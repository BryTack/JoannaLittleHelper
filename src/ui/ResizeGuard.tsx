import React, { useEffect, useState } from "react";

const MIN_WIDTH = 300;
const MIN_HEIGHT = 400;

interface ResizeGuardProps {
  children: React.ReactNode;
}

export function ResizeGuard({ children }: ResizeGuardProps): React.ReactElement {
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    const check = (width: number, height: number) => {
      setTooSmall(width < MIN_WIDTH || height < MIN_HEIGHT);
    };

    check(document.body.clientWidth, document.body.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      check(width, height);
    });

    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  if (tooSmall) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: "24px",
        textAlign: "center",
        gap: "12px",
      }}>
        <img src="../../assets/jlh-logo.png" width={48} height={48} alt="JLH" />
        <strong style={{ fontSize: "14px" }}>Joanna's Little Helper</strong>
        <p style={{ fontSize: "13px", color: "#605e5c", margin: 0 }}>
          Drag the left edge of this pane to make it wider,
          or drag the bottom edge to make it taller.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
