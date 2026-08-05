import React, { useContext, useEffect, useRef, useState } from 'react';
import AppContext from '../AppContext';
import ChannelTag from '../models/ChannelTag';
import CategoryStore from '../utils/CategoryStore';
import RemoteKeys from '../utils/RemoteKeys';
import { ALL_CHANNELS } from '../models/ChannelFilter';

/** Tags at or above this share of the lineup are useless as filters. */
const UNIVERSAL_TAG_THRESHOLD = 0.95;

/**
 * Which tags start ticked in the picker. Tags carried by nearly every channel
 * cannot usefully filter anything, so they start unticked - the user can still
 * tick them.
 */
export const defaultTagSelection = (tags: ChannelTag[], totalChannels: number): string[] => {
    if (totalChannels <= 0) {
        return [];
    }
    return tags
        .filter((tag) => tag.channelCount < totalChannels * UNIVERSAL_TAG_THRESHOLD)
        .map((tag) => tag.uuid);
};

/** Tags the server reports that we have never shown the user before. */
export const findNewTagUuids = (tags: ChannelTag[], knownUuids: string[]): string[] =>
    tags.filter((tag) => knownUuids.indexOf(tag.uuid) < 0).map((tag) => tag.uuid);

const CategorySetup = (props: { unmount: () => void }) => {
    const { epgData, channelTags, setActiveFilter } = useContext(AppContext);
    const wrapper = useRef<HTMLDivElement>(null);

    const totalChannels = epgData.getAllChannels().length;
    const isConfigured = CategoryStore.isConfigured();
    const newTagUuids = findNewTagUuids(channelTags, CategoryStore.getKnownTagUuids());

    const [selected, setSelected] = useState<string[]>(() =>
        isConfigured ? CategoryStore.getSelectedTagUuids() : defaultTagSelection(channelTags, totalChannels)
    );
    const [focusedIndex, setFocusedIndex] = useState(0);

    const toggle = (uuid: string) => {
        const index = selected.indexOf(uuid);
        const next = selected.slice();
        if (index >= 0) {
            next.splice(index, 1);
        } else {
            next.push(uuid);
        }
        setSelected(next);
    };

    const save = () => {
        // preserve server order so the rail matches the picker
        const ordered = channelTags.filter((tag) => selected.indexOf(tag.uuid) >= 0).map((tag) => tag.uuid);
        CategoryStore.setSelectedTagUuids(ordered);
        CategoryStore.setKnownTagUuids(channelTags.map((tag) => tag.uuid));
        // a category that just disappeared must not stay active
        const active = CategoryStore.getActiveFilter();
        if (active.kind === 'tag' && ordered.indexOf(active.tagUuid || '') < 0) {
            setActiveFilter(ALL_CHANNELS);
        }
        props.unmount();
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        switch (event.keyCode) {
            case RemoteKeys.ARROW_UP:
                event.stopPropagation();
                setFocusedIndex(focusedIndex > 0 ? focusedIndex - 1 : channelTags.length);
                break;
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                setFocusedIndex(focusedIndex < channelTags.length ? focusedIndex + 1 : 0);
                break;
            case RemoteKeys.OK:
                event.stopPropagation();
                focusedIndex === channelTags.length ? save() : toggle(channelTags[focusedIndex].uuid);
                break;
            case RemoteKeys.BACK:
                event.stopPropagation();
                // back without saving still counts as configured on first run,
                // otherwise the picker reappears on every launch
                if (!isConfigured) {
                    save();
                } else {
                    props.unmount();
                }
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        wrapper.current?.focus();
    }, []);

    return (
        <div
            id="category-setup"
            className="categorySetup"
            ref={wrapper}
            tabIndex={-1}
            onKeyDown={handleKeyPress}
        >
            <h2>Choose your categories</h2>
            <p className="categoryHint">
                These become the filters above your channel list. Tags carried by almost every channel are unticked
                because they cannot narrow anything down.
            </p>

            {channelTags.map((tag, index) => (
                <div
                    className={index === focusedIndex ? 'categoryRow focused' : 'categoryRow'}
                    key={tag.uuid}
                    onClick={() => toggle(tag.uuid)}
                >
                    <span className="categoryBox">
                        {/* Drawn in CSS. U+2610/U+2611 are in the same
                            unavailable-on-webOS class as the caret glyph that
                            rendered as a .notdef box on the C5. */}
                        <span
                            className={
                                selected.indexOf(tag.uuid) >= 0 ? 'categoryCheck checked' : 'categoryCheck'
                            }
                        />
                    </span>
                    <span className="categoryName">{tag.name}</span>
                    <span className="categoryCount">{tag.channelCount}</span>
                    {newTagUuids.indexOf(tag.uuid) >= 0 && <span className="categoryNew">new</span>}
                </div>
            ))}

            <div
                className={focusedIndex === channelTags.length ? 'categoryRow focused' : 'categoryRow'}
                onClick={save}
            >
                <span className="categoryName">Save</span>
            </div>
        </div>
    );
};

export default CategorySetup;
