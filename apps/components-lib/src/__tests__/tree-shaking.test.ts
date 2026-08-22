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

  it("should export FormField from form-field entry point", () => {
    const { FormField } = require("../FormField.entry.ts");
    expect(FormField).toBeDefined();
  });

  it("should export Select from select entry point", () => {
    const { Select } = require("../Select.entry.ts");
    expect(Select).toBeDefined();
  });

  it("should export Textarea from textarea entry point", () => {
    const { Textarea } = require("../Textarea.entry.ts");
    expect(Textarea).toBeDefined();
  });

  it("should export CampaignHeader from campaign-header entry point", () => {
    const { CampaignHeader } = require("../CampaignHeader.entry.ts");
    expect(CampaignHeader).toBeDefined();
  });

  it("should export CampaignProgress from campaign-progress entry point", () => {
    const { CampaignProgress } = require("../CampaignProgress.entry.ts");
    expect(CampaignProgress).toBeDefined();
  });

  it("should export CampaignActions from campaign-actions entry point", () => {
    const { CampaignActions } = require("../CampaignActions.entry.ts");
    expect(CampaignActions).toBeDefined();
  });

  it("should allow importing entire library from index", () => {
    const {
      Button,
      Input,
      Modal,
      Card,
      ProgressBar,
      FormField,
      Select,
      Textarea,
      CampaignHeader,
      CampaignProgress,
      CampaignActions,
      cn,
    } = require("../index.ts");
    expect(Button).toBeDefined();
    expect(Input).toBeDefined();
    expect(Modal).toBeDefined();
    expect(Card).toBeDefined();
    expect(ProgressBar).toBeDefined();
    expect(FormField).toBeDefined();
    expect(Select).toBeDefined();
    expect(Textarea).toBeDefined();
    expect(CampaignHeader).toBeDefined();
    expect(CampaignProgress).toBeDefined();
    expect(CampaignActions).toBeDefined();
    expect(cn).toBeDefined();
  });
});
