import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

describe("Button", () => {
  it("is disabled and aria-busy while loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("FormField", () => {
  it("links label, input and error message", () => {
    render(
      <FormField label="Email" error="Enter a valid email" required>
        {(p) => <Input {...p} />}
      </FormField>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Enter a valid email");
  });

  it("has no error attributes when valid", () => {
    render(<FormField label="Name">{(p) => <Input {...p} />}</FormField>);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });
});
