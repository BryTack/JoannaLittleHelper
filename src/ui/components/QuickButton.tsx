import React from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { GeneralButton } from "../../integrations/api/configClient";

interface QuickButtonProps {
  btn: GeneralButton;
  fallbackColour: string;
  /** If omitted the button renders as a non-interactive visual preview. */
  onClick?: () => void;
}

/**
 * A quick-prompt button with an optional description tooltip.
 * Used in AI tabs (functional) and the Home tab (preview-only).
 */
export function QuickButton({ btn, fallbackColour, onClick }: QuickButtonProps): React.ReactElement {
  const colour = btn.colour ?? fallbackColour;

  const button = (
    <Button
      size="small"
      appearance="outline"
      style={{ backgroundColor: colour }}
      onClick={onClick}
    >
      {btn.name}
    </Button>
  );

  if (!btn.description) return button;

  return (
    <Tooltip content={btn.description} relationship="description">
      {button}
    </Tooltip>
  );
}
