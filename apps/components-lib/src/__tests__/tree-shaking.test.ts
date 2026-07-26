import { describe, it, expect } from "vitest";

describe("tree-shaking: per-component imports", () => {
  it("should export Button from button entry point", () => {
    const { Button } = require("../Button.entry.ts");
    expect(Button).toBeDefined();
  });

  it("should export Input from input entry point", () => {
    const { Input } = require("../Input.entry.ts");
    expect(Input).toBeDefined();
  });

  it("should export Modal from modal entry point", () => {
    const { Modal } = require("../Modal.entry.ts");
    expect(Modal).toBeDefined();
  });

  it("should export Card components from card entry point", () => {
    const { Card, CardHeader, CardBody, CardFooter } = require("../Card.entry.ts");
    expect(Card).toBeDefined();
    expect(CardHeader).toBeDefined();
    expect(CardBody).toBeDefined();
    expect(CardFooter).toBeDefined();
  });

  it("should export ProgressBar from progress-bar entry point", () => {
    const { ProgressBar } = require("../ProgressBar.entry.ts");
    expect(ProgressBar).toBeDefined();
  });

  it("should allow importing entire library from index", () => {
    const { Button, Input, Modal, Card, ProgressBar, cn } = require("../index.ts");
    expect(Button).toBeDefined();
    expect(Input).toBeDefined();
    expect(Modal).toBeDefined();
    expect(Card).toBeDefined();
    expect(ProgressBar).toBeDefined();
    expect(cn).toBeDefined();
  });
});
