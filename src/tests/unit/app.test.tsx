import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/app/App";
import { useFlow } from "@/store/flow";
import { useSettings } from "@/store/settings";
import { initialState } from "@/features/grounding/machine";

beforeEach(() => {
  localStorage.clear();
  useFlow.setState({ flow: initialState });
  useSettings.setState({ reducedMotion: "system", demo: false, aiMode: "off", onboarded: true });
  location.hash = "";
});

describe("MERA app (accessibility-critical paths)", () => {
  it("GROUND ME is the dominant control and starts grounding in one tap", async () => {
    const user = userEvent.setup();
    render(<App />);
    const ground = screen.getByRole("button", { name: "GROUND ME" });
    expect(screen.getByRole("heading", { level: 1, name: "Come back to yourself." })).toBeInTheDocument();
    await user.click(ground);
    const dialog = screen.getByRole("dialog", { name: "Grounding reset" });
    expect(within(dialog).getByRole("heading", { name: "I’m here." })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Start reset" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "I need something quieter" })).toBeInTheDocument();
  });

  it("the rest of the app is hidden from assistive tech while a reset runs, and Exit is always available", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole("button", { name: "GROUND ME" }));
    expect(container.querySelector("[inert]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /Exit/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "GROUND ME" })).toBeVisible();
  });

  it("Escape exits the reset safely", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "GROUND ME" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'something quieter' turns on quiet mode (no sound or haptics, less motion)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "GROUND ME" }));
    await user.click(screen.getByRole("button", { name: "I need something quieter" }));
    expect(useFlow.getState().flow).toMatchObject({ step: "BODY_AWARENESS", quiet: true });
    expect(await screen.findByRole("heading", { name: "Put both feet on the ground." })).toBeInTheDocument();
  });

  it("reduced motion and text size apply to the whole app", async () => {
    render(<App />);
    act(() => useSettings.getState().set({ reducedMotion: "reduce", textSize: "larger", contrast: "more" }));
    expect(document.documentElement.dataset).toMatchObject({ motion: "reduced", text: "larger", contrast: "more" });
  });

  it("a persisted reset resumes after a refresh", () => {
    useFlow.setState({ flow: { ...initialState, step: "SENSE_3", startedAt: Date.now(), resetId: "r" } });
    render(<App />);
    expect(screen.getByRole("heading", { name: /Notice three sounds/ })).toBeInTheDocument();
  });
});
