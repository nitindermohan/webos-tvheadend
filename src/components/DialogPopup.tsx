import React from 'react';
import Dialog from '@enact/moonstone/Dialog';
import BodyText from '@enact/moonstone/BodyText';
import Button from '@enact/moonstone/Button';
import { forProp, handle, oneOf } from '@enact/core/handle';
import kind from '@enact/core/kind';
import { spotlightDefaultClass } from '@enact/spotlight/SpotlightContainerDecorator';

interface ButtonProps {
    source: 'confirm' | 'abort';
    children: React.ReactNode;
    className?: string;
}

const DialogPopup = (props: {
    title: string;
    subtitle: string;
    confirmText: string;
    abortText: string;
    confirmAction: () => void;
    abortAcion: () => void;
    // when true, spotlight focuses the abort button first instead of Enact's
    // own default (the first-rendered button, confirm) - for a caller whose
    // surrounding screen swallows arrow keys while this dialog is open (so
    // the user cannot 5-way-navigate from confirm to abort), this makes the
    // one button OK can reach the safe one. Existing callers do not pass
    // this and keep Enact's unmodified default-focus behaviour.
    focusAbortByDefault?: boolean;
}) => {
    const dialogHandler = handle(
        // suppress React event warnings in CodeSandbox console
        oneOf([forProp('source', 'confirm'), props.confirmAction], [forProp('source', 'abort'), props.abortAcion])
    );

    const DialogButton = kind<ButtonProps>({
        name: 'DialogButton',
        handlers: {
            onClick: dialogHandler
        },
        render: (props) => <Button {...props} />
    });

    return (
        <Dialog
            open={true}
            title={props.title}
            buttons={
                <>
                    <DialogButton source="confirm">{props.confirmText}</DialogButton>
                    <DialogButton
                        source="abort"
                        className={props.focusAbortByDefault ? spotlightDefaultClass : undefined}
                    >
                        {props.abortText}
                    </DialogButton>
                </>
            }
        >
            <BodyText>{props.subtitle}</BodyText>
        </Dialog>
    );
};

export default DialogPopup;
