import * as _ from 'lodash';
import * as React from 'react';
import { get } from 'typesafe-get';
import { observer, Observer } from 'mobx-react';
import { observable, action, computed } from 'mobx';

import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

import { styled } from '../../styles'
import { FontAwesomeIcon, WarningIcon } from '../../icons';
import { FailedTlsRequest } from '../../types';

import { HttpExchange } from '../../model/exchange';
import { getExchangeSummaryColour, ExchangeCategory } from '../../model/exchange-colors';

import { EmptyState } from '../common/empty-state';
import { StatusCode } from '../common/status-code';

import { TableFooter, HEADER_FOOTER_HEIGHT } from './view-event-list-footer';

const EmptyStateOverlay = styled(EmptyState)`
    position: absolute;
    top: ${HEADER_FOOTER_HEIGHT}px;
    bottom: ${HEADER_FOOTER_HEIGHT}px;
    height: auto;
`;

export type CollectedEvent = HttpExchange | FailedTlsRequest

interface ViewEventListProps {
    className?: string;
    selectedEvent: CollectedEvent | undefined;
    onSelected: (event: CollectedEvent | undefined) => void;
    onClear: () => void;
    events: CollectedEvent[];
    isPaused: boolean;
}

const ListContainer = styled.div`
    width: 100%;
    height: 100%;

    /* For unclear reasons, we need -4 to make the autosizer size this correctly: */
    padding-bottom: ${HEADER_FOOTER_HEIGHT - 4}px;
    box-sizing: border-box;

    font-size: ${p => p.theme.textSize};

    &::after {
        content: '';
        position: absolute;
        top: ${HEADER_FOOTER_HEIGHT}px;
        bottom: ${HEADER_FOOTER_HEIGHT}px;
        left: 0;
        right: 0;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 30px inset;
        pointer-events: none;
    }
`;

const Column = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 3px 0;
`;

const RowMarker = styled(Column)`
    transition: color 0.2s;
    color: ${(p: { category: ExchangeCategory }) => getExchangeSummaryColour(p.category)};

    background-color: currentColor;

    flex-basis: 5px;
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    padding: 0;

    border-left: 5px solid ${p => p.theme.containerBackground};
`;

const MarkerHeader = styled.div`
    flex-basis: 10px;
    flex-shrink: 0;
`;

const Method = styled(Column)`
    flex-basis: 71px;
    flex-shrink: 0;
    flex-grow: 0;
`;

const Status = styled(Column)`
    flex-basis: 45px;
    flex-shrink: 0;
    flex-grow: 0;
`;

const Source = styled(Column)`
    flex-basis: 49px;
    flex-shrink: 0;
    flex-grow: 0;
    text-align: center;
`;

const Host = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 500px;
`;

const PathAndQuery = styled(Column)`
    flex-shrink: 1;
    flex-grow: 0;
    flex-basis: 1000px;
`;

const EventListRow = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    user-select: none;
    cursor: pointer;

    &.selected {
        background-color: ${p => p.theme.highlightBackground};
        font-weight: bold;
    }

    &:focus {
        outline: thin dotted ${p => p.theme.popColor};
    }
`;

const ExchangeListRow = styled(EventListRow)`
    background-color: ${props => props.theme.mainBackground};

    border-width: 2px 0;
    border-style: solid;
    border-color: transparent;
    background-clip: padding-box;
    box-sizing: border-box;

    &:hover ${RowMarker}, &.selected ${RowMarker} {
        border-color: currentColor;
    }

    > * {
        margin-right: 10px;
    }
`;

const FailedRequestListRow = styled(EventListRow)`
    height: 28px !important; /* Important required to override react-window's style attr */
    margin: 2px 0;

    font-style: italic;
    justify-content: center;
    text-align: center;

    opacity: 0.7;

    &:hover {
        opacity: 1;
    }

    &.selected {
        opacity: 1;
        color: ${p => p.theme.mainColor};
        background-color: ${p => p.theme.mainBackground};
    }
`;

export const TableHeader = styled.header`
    height: 38px;
    overflow: hidden;
    width: 100%;

    display: flex;
    flex-direction: row;
    align-items: center;

    background-color: ${props => props.theme.mainBackground};
    color: ${props => props.theme.mainColor};
    font-weight: bold;

    border-bottom: 1px solid ${props => props.theme.containerBorder};
    box-shadow: 0 0 30px rgba(0,0,0,0.2);

    padding-right: 18px;
    box-sizing: border-box;

    > div {
        padding: 5px 0;
        margin-right: 10px;
        min-width: 0px;

        &:first-of-type {
            margin-left: 0;
        }
    }
`;

interface EventRowProps extends ListChildComponentProps {
    data: {
        selectedEvent: CollectedEvent | undefined;
        events: CollectedEvent[];
    }
}

const EventRow = observer((props: EventRowProps) => {
    const { index, style } = props;
    const { events, selectedEvent } = props.data;
    const event = events[index];

    const isSelected = (selectedEvent === event);

    if ('failureCause' in event) {
        return <FailedRequestRow
            index={index}
            isSelected={isSelected}
            style={style}
            failure={event}
        />;
    } else {
        return <ExchangeRow
            index={index}
            isSelected={isSelected}
            style={style}
            exchange={event}
        />;
    };
});

const ExchangeRow = observer(({
    index,
    isSelected,
    style,
    exchange: { id, category, isBreakpointed, request, response }
}: {
    index: number,
    isSelected: boolean,
    style: {},
    exchange: HttpExchange
}) =>
    <ExchangeListRow
        role="row"
        aria-label='row'
        aria-rowindex={index + 1}
        data-event-id={id}
        tabIndex={isSelected ? 0 : -1}

        className={isSelected ? 'selected' : ''}
        style={style}
    >
        <RowMarker category={category} />
        <Method>{ request.method }</Method>
        <Status>
            {
                response === 'aborted'
                    ? <StatusCode status={'aborted'} />
                : isBreakpointed
                    ? <WarningIcon title='Breakpointed, waiting to be resumed' />
                : <StatusCode
                    status={get(response, 'statusCode')}
                    message={get(response, 'statusMessage')}
                />
            }
        </Status>
        <Source>
            <FontAwesomeIcon
                title={request.source.summary}
                {...request.source.icon}
                fixedWidth={true}
            />
        </Source>
        <Host>
            { request.parsedUrl.host }
        </Host>
        <PathAndQuery>
            { request.parsedUrl.pathname + request.parsedUrl.search }
        </PathAndQuery>
    </ExchangeListRow>
);

const FailedRequestRow = observer((p: {
    index: number,
    failure: FailedTlsRequest,
    isSelected: boolean,
    style: {}
}) =>
    <FailedRequestListRow
        role="row"
        aria-label='row'
        aria-rowindex={p.index + 1}
        data-event-id={p.failure.id}
        tabIndex={p.isSelected ? 0 : -1}

        className={p.isSelected ? 'selected' : ''}
        style={p.style}
    >
        {
            ({
                'closed': 'Aborted ',
                'reset': 'Aborted ',
                'unknown': 'Aborted ',
                'cert-rejected': 'Certificate rejected for ',
                'no-shared-cipher': 'HTTPS setup failed for ',
            } as _.Dictionary<string>)[p.failure.failureCause]
        }
        connection to { p.failure.hostname || 'unknown domain' }
    </FailedRequestListRow>
);

@observer
export class ViewEventList extends React.Component<ViewEventListProps> {

    @computed
    get selectedEventId() {
        return this.props.selectedEvent
            ? this.props.selectedEvent.id
            : undefined;
    }

    @observable searchFilter: string | false = false;

    @computed get listItemData(): EventRowProps['data'] {
        return {
            selectedEvent: this.props.selectedEvent,
            events: this.filteredEvents
        };
    }

    @computed
    private get filteredEvents() {
        if (!this.searchFilter) return this.props.events;

        let filter = this.searchFilter.toLocaleLowerCase();
        return this.props.events.filter((event) => {
            return event.searchIndex.includes(filter)
        });
    }

    private listBodyRef = React.createRef<HTMLDivElement>();
    private listRef = React.createRef<List>();

    private KeyBoundListWindow = observer(
        React.forwardRef<HTMLDivElement>(
            (props: any, ref) => <section
                {...props}
                style={Object.assign({}, props.style, { 'overflowY': 'scroll' })}
                ref={ref}

                onFocus={this.focusSelectedEvent}
                onKeyDown={this.onKeyDown}
                onMouseDown={this.onListMouseDown}
                tabIndex={this.props.selectedEvent != null ? -1 : 0}
            />
        )
    );

    render() {
        const { events, onClear, isPaused } = this.props;
        const { filteredEvents } = this;

        return <ListContainer>
            {/* Footer is above the table in HTML order to ensure correct tab order */}
            <TableFooter
                allEvents={events}
                filteredEvents={filteredEvents}
                currentSearch={this.searchFilter || ''}
                onSearch={this.onSearchInput}
                onClear={onClear}
            />

            <TableHeader>
                <MarkerHeader />
                <Method>Method</Method>
                <Status>Status</Status>
                <Source>Source</Source>
                <Host>Host</Host>
                <PathAndQuery>Path and query</PathAndQuery>
            </TableHeader>

            {
                events.length === 0
                ? (isPaused
                    ? <EmptyStateOverlay icon={['fas', 'pause']}>
                        Interception is paused, resume it to collect intercepted requests
                    </EmptyStateOverlay>
                    : <EmptyStateOverlay icon={['fas', 'plug']}>
                        Connect a client and intercept some requests, and they'll appear here
                    </EmptyStateOverlay>
                )

                : filteredEvents.length === 0
                ? <EmptyStateOverlay icon={['fas', 'question']}>
                        No requests match this search filter{
                            isPaused ? ' and interception is paused' : ''
                        }
                </EmptyStateOverlay>

                : <AutoSizer>{({ height, width }) =>
                    <Observer>{() =>
                        <List
                            innerRef={this.listBodyRef}
                            outerElementType={this.KeyBoundListWindow}
                            ref={this.listRef}

                            height={height - 42} // Leave space for the footer
                            width={width}
                            itemCount={filteredEvents.length}
                            itemSize={32}
                            itemData={this.listItemData}
                        >
                            { EventRow }
                        </List>
                    }</Observer>
                }</AutoSizer>
            }
        </ListContainer>;
    }

    focusSelectedEvent = () => {
        if (!this.listRef.current || !this.listBodyRef.current) return;

        const listBody = this.listBodyRef.current;
        const listWindow = listBody.parentElement!;
        if (!listWindow.contains(document.activeElement)) return;

        // Something in the table is focused, make sure it's the correct thing:

        if (this.selectedEventId != null) {
            const rowElement = listBody.querySelector(
                `[data-event-id='${this.selectedEventId}']`
            ) as HTMLDivElement;
            if (rowElement) rowElement.focus();
        } else {
            const listWindow = listBody.parentElement!;
            listWindow.focus();
        }
    }

    componentDidUpdate() {
        this.focusSelectedEvent();
    }

    onListMouseDown = (mouseEvent: React.MouseEvent) => {
        if (mouseEvent.button !== 0) return; // Left clicks only

        let row: Element | null = mouseEvent.target as Element;
        let ariaRowIndex: string | null = null;

        // Climb up until we find the row, or the container
        while (ariaRowIndex === null && row && row !== this.listBodyRef.current) {
            // Be a little careful - React thinks event targets might not have getAttribute
            ariaRowIndex = row.getAttribute && row.getAttribute('aria-rowindex');
            row = row.parentElement;
        }

        if (!ariaRowIndex) return;

        const eventIndex = parseInt(ariaRowIndex, 10) - 1;
        const event = this.filteredEvents[eventIndex];
        if (event !== this.props.selectedEvent) {
            this.onEventSelected(eventIndex);
        } else {
            // Clicking the selected row deselects it
            this.onEventDeselected();
        }
    }

    @action.bound
    onEventSelected(index: number) {
        this.props.onSelected(this.filteredEvents[index]);
    }

    @action.bound
    onEventDeselected() {
        this.props.onSelected(undefined);
    }

    @action.bound
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (this.filteredEvents.length === 0) return;

        const { filteredEvents } = this;

        let currentIndex = _.findIndex(filteredEvents, { id: this.selectedEventId });
        let targetIndex: number | undefined;

        switch (event.key) {
            case 'j':
            case 'ArrowDown':
                targetIndex = currentIndex === -1
                    ? 0
                    : Math.min(currentIndex + 1, filteredEvents.length - 1);
                break;
            case 'k':
            case 'ArrowUp':
                targetIndex = currentIndex === -1
                    ? filteredEvents.length - 1
                    : Math.max(currentIndex - 1, 0);
                break;
            case 'PageUp':
                targetIndex = currentIndex === -1
                    ? undefined
                    : Math.max(currentIndex - 10, 0);
                break;
            case 'PageDown':
                targetIndex = currentIndex === -1
                    ? undefined
                    : Math.min(currentIndex + 10, filteredEvents.length - 1);
                break;
        }

        if (targetIndex !== undefined) {
            this.onEventSelected(targetIndex);
            if (this.listRef.current) {
                this.listRef.current.scrollToItem(targetIndex);
            }
            event.preventDefault();
        }
    }

    @action.bound
    onSearchInput(input: string) {
        this.searchFilter = input || false;
    }
}