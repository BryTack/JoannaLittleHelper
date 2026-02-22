import React from "react";
import { Button } from "@fluentui/react-components";
import { GeneralButton } from "../../integrations/api/configClient";

interface QuickButtonProps {
  btn: GeneralButton;
  fallbackColour: string;
  /** If omitted the button renders as a non-interactive visual preview. */
  onClick?: () => void;
}

/**
 * A quick-prompt button. Description shown as a native browser tooltip (title).
 * Used in AI tabs (functional) and the Home tab (preview-only).
 */
export function QuickButton({ btn, fallbackColour, onClick }: QuickButtonProps): React.ReactElement {
  const colour = btn.colour ?? fallbackColour;
  return (
    <Button
      size="small"
      appearance="outline"
      title={btn.description ? `Button: ${btn.description}` : undefined}
      style={{ backgroundColor: colour }}
      onClick={onClick}
    >
      {btn.name}
    </Button>
  );
}
