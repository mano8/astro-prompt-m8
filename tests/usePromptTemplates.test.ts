import { describe, expect, it } from "vitest";
import {
  reorderTemplateBlocks,
  updateTemplateListBlockPosition
} from "../src/runtime/hooks/usePromptTemplates.js";
import type { PromptTemplatesPublic, TemplateBlockPublic } from "../src/runtime/schemas.js";

function templateBlock(blockId: number, position: number): TemplateBlockPublic {
  return {
    id: blockId,
    block_id: blockId,
    template_id: 10,
    name: `block-${blockId}`,
    slug: `block-${blockId}`,
    description: null,
    content: `content-${blockId}`,
    type: "role",
    is_dynamic: false,
    is_public: false,
    position
  };
}

describe("usePromptTemplates cache helpers", () => {
  it("reorders template blocks and preserves contiguous positions", () => {
    const reordered = reorderTemplateBlocks(
      [templateBlock(1, 1), templateBlock(2, 2), templateBlock(3, 3)],
      3,
      2
    );

    expect(reordered.map((block) => block.block_id)).toEqual([1, 3, 2]);
    expect(reordered.map((block) => block.position)).toEqual([1, 2, 3]);
  });

  it("updates the template list cache used by the editor page", () => {
    const data: PromptTemplatesPublic = {
      data: [
        {
          id: 10,
          name: "template",
          slug: "template",
          description: null,
          is_public: false,
          blocks: [templateBlock(1, 1), templateBlock(2, 2), templateBlock(3, 3)]
        }
      ],
      count: 1
    };

    const updated = updateTemplateListBlockPosition(data, {
      templateId: 10,
      blockId: 3,
      position: 2
    });

    expect(updated?.data[0]?.blocks.map((block) => block.block_id)).toEqual([1, 3, 2]);
  });
});
