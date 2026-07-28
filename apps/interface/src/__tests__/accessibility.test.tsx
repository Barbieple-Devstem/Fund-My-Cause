import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

describe("Accessibility (a11y) Regression Test Suite", () => {
  it("should pass accessibility checks for standard Button component", async () => {
    const { container } = render(
      <button type="button" className="btn btn-primary" aria-label="Submit contribution">
        Donate Now
      </button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for form inputs with proper labels and associations", async () => {
    const { container } = render(
      <form aria-label="Donation form">
        <label htmlFor="donation-amount">Donation Amount (XLM)</label>
        <input
          id="donation-amount"
          name="amount"
          type="number"
          min="1"
          placeholder="Enter amount"
          aria-required="true"
        />
        <button type="submit">Confirm Donation</button>
      </form>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for Navigation bar with landmark roles", async () => {
    const { container } = render(
      <nav aria-label="Main Navigation">
        <ul>
          <li>
            <a href="/campaigns">Explore Campaigns</a>
          </li>
          <li>
            <a href="/create">Start a Campaign</a>
          </li>
          <li>
            <a href="/about">About Us</a>
          </li>
        </ul>
      </nav>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for Campaign Card component with semantic markup", async () => {
    const { container } = render(
      <article aria-labelledby="campaign-title-1">
        <header>
          <h2 id="campaign-title-1">Clean Water Initiative</h2>
          <p>Help provide clean drinking water to remote villages.</p>
        </header>
        <section aria-label="Campaign Progress">
          <progress value="75" max="100" aria-label="75% of funding goal reached">
            75%
          </progress>
          <span>750 / 1000 XLM Raised</span>
        </section>
        <footer>
          <a href="/campaign/clean-water" aria-label="View details for Clean Water Initiative">
            View Campaign
          </a>
        </footer>
      </article>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for Modal Dialog with accessible title and description", async () => {
    const { container } = render(
      <div role="dialog" aria-modal="true" aria-labelledby="modal-heading" aria-describedby="modal-desc">
        <h2 id="modal-heading">Confirm Transaction</h2>
        <p id="modal-desc">Are you sure you want to pledge 500 XLM to this campaign?</p>
        <div>
          <button type="button">Cancel</button>
          <button type="button" className="btn-confirm">
            Confirm
          </button>
        </div>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
